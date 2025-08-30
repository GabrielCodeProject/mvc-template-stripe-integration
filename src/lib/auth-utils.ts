import { cookies, headers } from "next/headers";
import { AuthService } from "@/services/AuthService";
import { AuthUser } from "@/models/AuthUser";

// Get current user from session (server-side)
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return null;
    }
    
    const authService = AuthService.getInstance();
    return await authService.getUserBySession(sessionToken);
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

// Get user from middleware headers (for server components)
export async function getUserFromHeaders(): Promise<{
  id: string;
  email: string;
  role: string;
} | null> {
  try {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const userEmail = headersList.get('x-user-email');
    const userRole = headersList.get('x-user-role');
    
    if (!userId || !userEmail) {
      return null;
    }
    
    return {
      id: userId,
      email: userEmail,
      role: userRole || 'CUSTOMER'
    };
  } catch {
    return null;
  }
}

// Require authentication (throw error if not authenticated)
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

// Check if user has specific role
export function hasRole(user: { role: string }, ...roles: string[]): boolean {
  return roles.includes(user.role);
}

// Check if user is admin
export function isAdmin(user: { role: string }): boolean {
  return hasRole(user, 'ADMIN');
}

// Check if user is support
export function isSupport(user: { role: string }): boolean {
  return hasRole(user, 'SUPPORT', 'ADMIN');
}

// Password strength validation
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
    errors.push('Password should contain at least one special character');
  }
  
  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  
  if (errors.length === 0) {
    if (password.length >= 12 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      strength = 'strong';
    } else {
      strength = 'medium';
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generate secure random token
export function generateSecureToken(length: number = 32): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

// Format session expiry time
export function formatSessionExpiry(expiresAt: Date): string {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return 'Expired';
  }
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 24) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
}

// Check if browser supports WebAuthn
export function supportsWebAuthn(): boolean {
  return typeof window !== 'undefined' && 
         'credentials' in navigator && 
         'create' in navigator.credentials;
}

// Parse User-Agent for session metadata
export function parseUserAgent(userAgent?: string): {
  browser?: string;
  os?: string;
  device?: string;
} {
  if (!userAgent) return {};
  
  // Simple user agent parsing (in production, use a library like ua-parser-js)
  const result: { browser?: string; os?: string; device?: string } = {};
  
  // Browser detection
  if (userAgent.includes('Chrome/')) {
    result.browser = 'Chrome';
  } else if (userAgent.includes('Firefox/')) {
    result.browser = 'Firefox';
  } else if (userAgent.includes('Safari/')) {
    result.browser = 'Safari';
  } else if (userAgent.includes('Edge/')) {
    result.browser = 'Edge';
  }
  
  // OS detection
  if (userAgent.includes('Windows NT')) {
    result.os = 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    result.os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    result.os = 'Linux';
  } else if (userAgent.includes('iPhone OS')) {
    result.os = 'iOS';
  } else if (userAgent.includes('Android')) {
    result.os = 'Android';
  }
  
  // Device detection
  if (userAgent.includes('Mobile')) {
    result.device = 'Mobile';
  } else if (userAgent.includes('Tablet')) {
    result.device = 'Tablet';
  } else {
    result.device = 'Desktop';
  }
  
  return result;
}

// Sanitize user input
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

// Check if email domain is allowed
export function isAllowedEmailDomain(email: string, allowedDomains?: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  return allowedDomains.some(allowedDomain => 
    domain === allowedDomain.toLowerCase()
  );
}

// Get client IP address
export async function getClientIP(): Promise<string | null> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get('x-forwarded-for');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return headersList.get('x-real-ip') || 
           headersList.get('remote-addr') || 
           null;
  } catch {
    return null;
  }
}

// Generate backup codes for 2FA
export function generateBackupCodes(count: number = 8): string[] {
  const crypto = require('crypto');
  
  return Array.from({ length: count }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}

// Time-constant string comparison (prevents timing attacks)
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}