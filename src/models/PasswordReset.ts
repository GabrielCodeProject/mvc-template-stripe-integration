import crypto from 'crypto';
import {
  generateSecureToken,
  hashToken,
  generateTokenExpiry,
  isTokenExpired,
  isValidTokenFormat,
  timingSafeEquals,
  SECURITY_CONFIG,
  TokenError,
} from '@/lib/password-reset-utils';

/**
 * PasswordReset model for secure password reset token management
 * Implements OWASP security guidelines for token-based password reset
 */

export interface PasswordResetTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isUsed: boolean;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePasswordResetParams {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ValidateTokenParams {
  token: string;
  ipAddress?: string;
  userAgent?: string;
  requireIPMatch?: boolean;
  requireUserAgentMatch?: boolean;
}

export class PasswordReset {
  private _id: string;
  private _userId: string;
  private _tokenHash: string;
  private _plainToken?: string; // Only available during creation
  private _expiresAt: Date;
  private _ipAddress?: string;
  private _userAgent?: string;
  private _isUsed: boolean;
  private _usedAt?: Date;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(data: PasswordResetTokenData) {
    this._id = data.id;
    this._userId = data.userId;
    this._tokenHash = data.tokenHash;
    this._expiresAt = data.expiresAt;
    this._ipAddress = data.ipAddress;
    this._userAgent = data.userAgent;
    this._isUsed = data.isUsed;
    this._usedAt = data.usedAt;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  /**
   * Creates a new password reset token with secure generation
   */
  public static create(params: CreatePasswordResetParams): {
    passwordReset: PasswordReset;
    plainToken: string;
  } {
    const plainToken = generateSecureToken();
    const tokenHash = hashToken(plainToken);
    const expiresAt = generateTokenExpiry();
    const now = new Date();

    const data: PasswordResetTokenData = {
      id: crypto.randomUUID(),
      userId: params.userId,
      tokenHash,
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      isUsed: false,
      createdAt: now,
      updatedAt: now,
    };

    const passwordReset = new PasswordReset(data);
    passwordReset._plainToken = plainToken;

    return { passwordReset, plainToken };
  }

  /**
   * Validates a token against this password reset instance
   */
  public validateToken(params: ValidateTokenParams): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check token format
    if (!isValidTokenFormat(params.token)) {
      errors.push('Invalid token format');
    }

    // Check if token is used
    if (this._isUsed) {
      errors.push('Token has already been used');
    }

    // Check expiration
    if (isTokenExpired(this._expiresAt)) {
      errors.push('Token has expired');
    }

    // Hash provided token and compare with stored hash
    const providedTokenHash = hashToken(params.token);
    if (!timingSafeEquals(providedTokenHash, this._tokenHash)) {
      errors.push('Invalid token');
    }

    // IP address binding check (if enabled)
    if (params.requireIPMatch && this._ipAddress && params.ipAddress) {
      if (!timingSafeEquals(this._ipAddress, params.ipAddress)) {
        errors.push('Token not valid from this IP address');
      }
    }

    // User agent binding check (if enabled)
    if (params.requireUserAgentMatch && this._userAgent && params.userAgent) {
      if (!timingSafeEquals(this._userAgent, params.userAgent)) {
        errors.push('Token not valid from this user agent');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Marks the token as used
   */
  public markAsUsed(): void {
    if (this._isUsed) {
      throw new TokenError('Token has already been used');
    }

    this._isUsed = true;
    this._usedAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Checks if the token is expired
   */
  public isExpired(): boolean {
    return isTokenExpired(this._expiresAt);
  }

  /**
   * Checks if the token is still valid (not used and not expired)
   */
  public isValid(): boolean {
    return !this._isUsed && !this.isExpired();
  }

  /**
   * Gets the time remaining until expiration in milliseconds
   */
  public getTimeToExpiry(): number {
    return Math.max(0, this._expiresAt.getTime() - Date.now());
  }

  /**
   * Gets the age of the token in milliseconds
   */
  public getAge(): number {
    return Date.now() - this._createdAt.getTime();
  }

  /**
   * Validates the token structure and constraints
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!this._id) {
      errors.push('ID is required');
    }

    if (!this._userId) {
      errors.push('User ID is required');
    }

    if (!this._tokenHash) {
      errors.push('Token hash is required');
    }

    if (!this._expiresAt) {
      errors.push('Expiration date is required');
    }

    // Validate token hash format (should be hex)
    if (this._tokenHash && !/^[a-f0-9]{64}$/i.test(this._tokenHash)) {
      errors.push('Invalid token hash format');
    }

    // Validate expiration is in the future when created
    if (this._expiresAt && this._createdAt) {
      const maxExpiryTime = this._createdAt.getTime() + 
        SECURITY_CONFIG.TOKEN_EXPIRY_MINUTES * 60 * 1000 + 
        60 * 1000; // Allow 1 minute buffer

      if (this._expiresAt.getTime() > maxExpiryTime) {
        errors.push('Token expiry exceeds maximum allowed time');
      }
    }

    // Validate used state consistency
    if (this._isUsed && !this._usedAt) {
      errors.push('Used token must have usage timestamp');
    }

    if (!this._isUsed && this._usedAt) {
      errors.push('Unused token cannot have usage timestamp');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Creates a secure audit log entry for this token
   */
  public createAuditLogData(action: string, success: boolean, additionalDetails?: Record<string, unknown>): {
    userId: string;
    action: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    details: Record<string, unknown>;
  } {
    return {
      userId: this._userId,
      action,
      success,
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      details: {
        tokenId: this._id,
        tokenAge: this.getAge(),
        timeToExpiry: this.getTimeToExpiry(),
        wasUsed: this._isUsed,
        ...additionalDetails,
      },
    };
  }

  // Getters
  public get id(): string { return this._id; }
  public get userId(): string { return this._userId; }
  public get tokenHash(): string { return this._tokenHash; }
  public get plainToken(): string | undefined { return this._plainToken; }
  public get expiresAt(): Date { return this._expiresAt; }
  public get ipAddress(): string | undefined { return this._ipAddress; }
  public get userAgent(): string | undefined { return this._userAgent; }
  public get isUsed(): boolean { return this._isUsed; }
  public get usedAt(): Date | undefined { return this._usedAt; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  /**
   * Converts to JSON (excludes sensitive data)
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      userId: this._userId,
      expiresAt: this._expiresAt.toISOString(),
      ipAddress: this._ipAddress,
      isUsed: this._isUsed,
      usedAt: this._usedAt?.toISOString(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      isValid: this.isValid(),
      isExpired: this.isExpired(),
      timeToExpiry: this.getTimeToExpiry(),
      age: this.getAge(),
    };
  }

  /**
   * Converts to database format
   */
  public toDatabaseFormat(): PasswordResetTokenData {
    return {
      id: this._id,
      userId: this._userId,
      tokenHash: this._tokenHash,
      expiresAt: this._expiresAt,
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      isUsed: this._isUsed,
      usedAt: this._usedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Creates PasswordReset from database data
   */
  public static fromDatabaseData(data: PasswordResetTokenData): PasswordReset {
    return new PasswordReset(data);
  }

  /**
   * Creates PasswordReset from Prisma model
   */
  public static fromPrismaModel(data: any): PasswordReset {
    return new PasswordReset({
      id: data.id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      isUsed: data.isUsed,
      usedAt: data.usedAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  /**
   * Cleanup method to remove sensitive data
   */
  public clearSensitiveData(): void {
    this._plainToken = undefined;
  }

  /**
   * Generates a secure reset URL for email
   */
  public generateResetUrl(baseUrl: string): string {
    if (!this._plainToken) {
      throw new TokenError('Plain token not available for URL generation');
    }

    const url = new URL('/reset-password', baseUrl);
    url.searchParams.set('token', this._plainToken);
    
    return url.toString();
  }
}

// Type exports for external use