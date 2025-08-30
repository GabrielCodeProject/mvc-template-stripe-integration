import crypto from 'crypto';

/**
 * Secure token utilities for password reset functionality
 * Implements OWASP guidelines for secure token generation and validation
 */

// Constants for security configuration
export const SECURITY_CONFIG = {
  TOKEN_LENGTH: 64, // 64 bytes = 512 bits
  TOKEN_EXPIRY_MINUTES: 15, // 15 minutes for security
  HASH_ALGORITHM: 'sha256',
  RATE_LIMIT_EMAIL: {
    MAX_REQUESTS: 3,
    WINDOW_HOURS: 1,
  },
  RATE_LIMIT_IP: {
    MAX_REQUESTS: 10,
    WINDOW_HOURS: 1,
  },
} as const;

/**
 * Generates a cryptographically secure 64-byte token
 * @returns Base64URL encoded token string
 */
export function generateSecureToken(): string {
  const buffer = crypto.randomBytes(SECURITY_CONFIG.TOKEN_LENGTH);
  return buffer.toString('base64url'); // URL-safe base64 encoding
}

/**
 * Creates SHA-256 hash of a token for secure storage
 * @param token - The plain token to hash
 * @returns SHA-256 hash as hex string
 */
export function hashToken(token: string): string {
  return crypto
    .createHash(SECURITY_CONFIG.HASH_ALGORITHM)
    .update(token, 'utf8')
    .digest('hex');
}

/**
 * Validates token format and structure
 * @param token - Token to validate
 * @returns Boolean indicating if token format is valid
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Base64URL tokens should be ~86 characters for 64 bytes
  // Allow some variance for encoding differences
  if (token.length < 80 || token.length > 100) {
    return false;
  }

  // Check for valid base64url characters only
  const base64urlPattern = /^[A-Za-z0-9_-]+$/;
  return base64urlPattern.test(token);
}

/**
 * Generates expiration timestamp for reset tokens
 * @returns Date object representing token expiration
 */
export function generateTokenExpiry(): Date {
  return new Date(Date.now() + SECURITY_CONFIG.TOKEN_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Checks if a token has expired
 * @param expiresAt - Token expiration date
 * @returns Boolean indicating if token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculates rate limit window start time
 * @param hours - Number of hours for the window
 * @returns Date object representing window start
 */
export function getRateLimitWindowStart(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/**
 * Validates if IP address is within rate limits
 * @param requestCount - Current request count
 * @param windowStart - When the current window started
 * @param maxRequests - Maximum allowed requests
 * @param windowHours - Window duration in hours
 * @returns Object with rate limit status and reset time
 */
export function checkRateLimit(
  requestCount: number,
  windowStart: Date,
  maxRequests: number,
  windowHours: number
): { 
  isAllowed: boolean; 
  remainingRequests: number; 
  resetTime: Date;
  waitTimeMs?: number;
} {
  const now = new Date();
  const windowEnd = new Date(windowStart.getTime() + windowHours * 60 * 60 * 1000);
  
  // If we're past the window, allow the request (new window)
  if (now >= windowEnd) {
    return {
      isAllowed: true,
      remainingRequests: maxRequests - 1,
      resetTime: new Date(now.getTime() + windowHours * 60 * 60 * 1000),
    };
  }

  // Check if we're within limits
  if (requestCount < maxRequests) {
    return {
      isAllowed: true,
      remainingRequests: maxRequests - requestCount - 1,
      resetTime: windowEnd,
    };
  }

  // Rate limited
  return {
    isAllowed: false,
    remainingRequests: 0,
    resetTime: windowEnd,
    waitTimeMs: windowEnd.getTime() - now.getTime(),
  };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns Boolean indicating if strings match
 */
export function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  // Use crypto.timingSafeEqual for constant-time comparison
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Extracts and validates IP address from various headers
 * @param headers - Request headers
 * @returns Validated IP address or null
 */
export function extractClientIP(headers: {
  'x-forwarded-for'?: string;
  'x-real-ip'?: string;
  'remote-addr'?: string;
}): string | null {
  // Check forwarded headers in order of preference
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    // Take first IP from comma-separated list
    const ip = forwarded.split(',')[0].trim();
    if (isValidIP(ip)) {
      return ip;
    }
  }

  const realIP = headers['x-real-ip'];
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }

  const remoteAddr = headers['remote-addr'];
  if (remoteAddr && isValidIP(remoteAddr)) {
    return remoteAddr;
  }

  return null;
}

/**
 * Validates IP address format (IPv4 and IPv6)
 * @param ip - IP address to validate
 * @returns Boolean indicating if IP is valid
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (ipv4Pattern.test(ip)) {
    // Validate IPv4 octets are 0-255
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  // Basic IPv6 validation (could be enhanced)
  return ipv6Pattern.test(ip) || ip === '::1';
}

/**
 * Sanitizes user agent string for logging
 * @param userAgent - Raw user agent string
 * @returns Sanitized user agent string
 */
export function sanitizeUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent || typeof userAgent !== 'string') {
    return null;
  }

  // Remove potential XSS characters and limit length
  return userAgent
    .replace(/[<>'"]/g, '')
    .substring(0, 500)
    .trim() || null;
}

/**
 * Generates a secure audit log entry with consistent structure
 * @param params - Audit log parameters
 * @returns Structured audit log data
 */
export function createAuditLogEntry(params: {
  userId?: string;
  email?: string;
  action: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  additionalDetails?: Record<string, unknown>;
}): {
  userId?: string;
  email?: string;
  action: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  createdAt: Date;
} {
  return {
    userId: params.userId,
    email: params.email?.toLowerCase(),
    action: params.action,
    success: params.success,
    ipAddress: params.ipAddress,
    userAgent: sanitizeUserAgent(params.userAgent) || undefined,
    details: {
      timestamp: new Date().toISOString(),
      ...params.additionalDetails,
    },
    createdAt: new Date(),
  };
}

/**
 * Generates exponential backoff delay for rate limiting
 * @param attemptCount - Number of failed attempts
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Delay in milliseconds with jitter
 */
export function calculateExponentialBackoff(
  attemptCount: number,
  baseDelayMs: number = 1000
): number {
  const maxDelay = 60000; // 1 minute max
  const delay = Math.min(baseDelayMs * Math.pow(2, attemptCount), maxDelay);
  
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  
  return Math.round(delay + jitter);
}

// Error types for better error handling
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class RateLimitError extends SecurityError {
  constructor(
    message: string,
    public readonly retryAfterMs: number
  ) {
    super(message, 'RATE_LIMITED', 429);
    this.name = 'RateLimitError';
  }
}

export class TokenError extends SecurityError {
  constructor(message: string) {
    super(message, 'INVALID_TOKEN', 400);
    this.name = 'TokenError';
  }
}