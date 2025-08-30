import { prisma } from '@/lib/prisma';
import { PasswordReset, PasswordResetTokenData } from '@/models/PasswordReset';
import { AuthUser } from '@/models/AuthUser';
import {
  SECURITY_CONFIG,
  getRateLimitWindowStart,
  checkRateLimit,
  createAuditLogEntry,
  SecurityError,
  RateLimitError,
} from '@/lib/password-reset-utils';

/**
 * Repository for password reset token management with comprehensive security features
 * Implements secure token storage, rate limiting, and audit logging
 */

export interface EmailRateLimitData {
  email: string;
  requestCount: number;
  windowStart: Date;
}

export interface IpRateLimitData {
  ipAddress: string;
  requestCount: number;
  windowStart: Date;
  blockedUntil?: Date;
}

export interface SecurityAuditData {
  userId?: string;
  email?: string;
  action: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export class PasswordResetRepository {
  private static instance: PasswordResetRepository;

  private constructor() {}

  public static getInstance(): PasswordResetRepository {
    if (!PasswordResetRepository.instance) {
      PasswordResetRepository.instance = new PasswordResetRepository();
    }
    return PasswordResetRepository.instance;
  }

  /**
   * Creates a new password reset token in the database
   */
  public async createToken(passwordReset: PasswordReset): Promise<PasswordReset> {
    try {
      const data = passwordReset.toDatabaseFormat();
      
      const created = await prisma.passwordResetToken.create({
        data: {
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
        },
      });

      return PasswordReset.fromPrismaModel(created);
    } catch (error) {
      console.error('Failed to create password reset token:', error);
      throw new SecurityError('Failed to create password reset token', 'DATABASE_ERROR', 500);
    }
  }

  /**
   * Finds a password reset token by its hash
   */
  public async findByTokenHash(tokenHash: string): Promise<PasswordReset | null> {
    try {
      const token = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      return token ? PasswordReset.fromPrismaModel(token) : null;
    } catch (error) {
      console.error('Failed to find password reset token:', error);
      return null;
    }
  }

  /**
   * Finds password reset tokens by user ID
   */
  public async findByUserId(userId: string): Promise<PasswordReset[]> {
    try {
      const tokens = await prisma.passwordResetToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return tokens.map(token => PasswordReset.fromPrismaModel(token));
    } catch (error) {
      console.error('Failed to find password reset tokens by user ID:', error);
      return [];
    }
  }

  /**
   * Marks a token as used
   */
  public async markTokenAsUsed(tokenId: string): Promise<boolean> {
    try {
      const result = await prisma.passwordResetToken.update({
        where: { id: tokenId },
        data: {
          isUsed: true,
          usedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return !!result;
    } catch (error) {
      console.error('Failed to mark token as used:', error);
      return false;
    }
  }

  /**
   * Finds user by email for password reset
   */
  public async findUserByEmail(email: string): Promise<AuthUser | null> {
    try {
      const userData = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          accounts: true,
          sessions: true
        }
      });
      
      return userData ? AuthUser.fromPrismaModel(userData) : null;
    } catch (error) {
      console.error('Failed to find user by email:', error);
      return null;
    }
  }

  /**
   * Updates user password securely
   */
  public async updateUserPassword(userId: string, passwordHash: string): Promise<boolean> {
    try {
      // Update password in credentials account
      await prisma.account.updateMany({
        where: {
          userId,
          providerId: 'credentials'
        },
        data: {
          password: passwordHash,
          updatedAt: new Date()
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to update user password:', error);
      return false;
    }
  }

  /**
   * Invalidates all existing password reset tokens for a user
   */
  public async invalidateUserTokens(userId: string): Promise<number> {
    try {
      const result = await prisma.passwordResetToken.updateMany({
        where: {
          userId,
          isUsed: false,
          expiresAt: {
            gte: new Date()
          }
        },
        data: {
          isUsed: true,
          usedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      console.error('Failed to invalidate user tokens:', error);
      return 0;
    }
  }

  /**
   * Checks and updates email-based rate limiting
   */
  public async checkEmailRateLimit(email: string): Promise<{
    isAllowed: boolean;
    remainingRequests: number;
    resetTime: Date;
    waitTimeMs?: number;
  }> {
    try {
      const now = new Date();
      const windowStart = getRateLimitWindowStart(SECURITY_CONFIG.RATE_LIMIT_EMAIL.WINDOW_HOURS);

      // Find existing rate limit entry
      let rateLimit = await prisma.emailRateLimit.findUnique({
        where: {
          email_type: {
            email: email.toLowerCase(),
            type: 'password_reset'
          }
        }
      });

      // If no entry exists or window has expired, create new one
      if (!rateLimit || rateLimit.windowStart < windowStart) {
        rateLimit = await prisma.emailRateLimit.upsert({
          where: {
            email_type: {
              email: email.toLowerCase(),
              type: 'password_reset'
            }
          },
          create: {
            email: email.toLowerCase(),
            type: 'password_reset',
            requestCount: 1,
            windowStart: now,
          },
          update: {
            requestCount: 1,
            windowStart: now,
            updatedAt: now,
          }
        });

        return {
          isAllowed: true,
          remainingRequests: SECURITY_CONFIG.RATE_LIMIT_EMAIL.MAX_REQUESTS - 1,
          resetTime: new Date(now.getTime() + SECURITY_CONFIG.RATE_LIMIT_EMAIL.WINDOW_HOURS * 60 * 60 * 1000),
        };
      }

      // Check current rate limit
      const rateLimitResult = checkRateLimit(
        rateLimit.requestCount,
        rateLimit.windowStart,
        SECURITY_CONFIG.RATE_LIMIT_EMAIL.MAX_REQUESTS,
        SECURITY_CONFIG.RATE_LIMIT_EMAIL.WINDOW_HOURS
      );

      // If allowed, increment counter
      if (rateLimitResult.isAllowed) {
        await prisma.emailRateLimit.update({
          where: {
            email_type: {
              email: email.toLowerCase(),
              type: 'password_reset'
            }
          },
          data: {
            requestCount: { increment: 1 },
            updatedAt: now,
          }
        });
      }

      return rateLimitResult;
    } catch (error) {
      console.error('Failed to check email rate limit:', error);
      // Fail open for availability, but log the error
      return {
        isAllowed: true,
        remainingRequests: SECURITY_CONFIG.RATE_LIMIT_EMAIL.MAX_REQUESTS - 1,
        resetTime: new Date(Date.now() + SECURITY_CONFIG.RATE_LIMIT_EMAIL.WINDOW_HOURS * 60 * 60 * 1000),
      };
    }
  }

  /**
   * Checks and updates IP-based rate limiting
   */
  public async checkIpRateLimit(ipAddress: string): Promise<{
    isAllowed: boolean;
    remainingRequests: number;
    resetTime: Date;
    waitTimeMs?: number;
  }> {
    try {
      const now = new Date();
      const windowStart = getRateLimitWindowStart(SECURITY_CONFIG.RATE_LIMIT_IP.WINDOW_HOURS);

      // Find existing rate limit entry
      let rateLimit = await prisma.ipRateLimit.findUnique({
        where: {
          ipAddress_action: {
            ipAddress,
            action: 'password_reset'
          }
        }
      });

      // Check if IP is currently blocked
      if (rateLimit?.blockedUntil && rateLimit.blockedUntil > now) {
        return {
          isAllowed: false,
          remainingRequests: 0,
          resetTime: rateLimit.blockedUntil,
          waitTimeMs: rateLimit.blockedUntil.getTime() - now.getTime(),
        };
      }

      // If no entry exists or window has expired, create new one
      if (!rateLimit || rateLimit.windowStart < windowStart) {
        rateLimit = await prisma.ipRateLimit.upsert({
          where: {
            ipAddress_action: {
              ipAddress,
              action: 'password_reset'
            }
          },
          create: {
            ipAddress,
            action: 'password_reset',
            requestCount: 1,
            windowStart: now,
          },
          update: {
            requestCount: 1,
            windowStart: now,
            blockedUntil: null,
            updatedAt: now,
          }
        });

        return {
          isAllowed: true,
          remainingRequests: SECURITY_CONFIG.RATE_LIMIT_IP.MAX_REQUESTS - 1,
          resetTime: new Date(now.getTime() + SECURITY_CONFIG.RATE_LIMIT_IP.WINDOW_HOURS * 60 * 60 * 1000),
        };
      }

      // Check current rate limit
      const rateLimitResult = checkRateLimit(
        rateLimit.requestCount,
        rateLimit.windowStart,
        SECURITY_CONFIG.RATE_LIMIT_IP.MAX_REQUESTS,
        SECURITY_CONFIG.RATE_LIMIT_IP.WINDOW_HOURS
      );

      // If allowed, increment counter
      if (rateLimitResult.isAllowed) {
        await prisma.ipRateLimit.update({
          where: {
            ipAddress_action: {
              ipAddress,
              action: 'password_reset'
            }
          },
          data: {
            requestCount: { increment: 1 },
            updatedAt: now,
          }
        });
      } else {
        // Block IP for additional time if limit exceeded
        const blockUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
        await prisma.ipRateLimit.update({
          where: {
            ipAddress_action: {
              ipAddress,
              action: 'password_reset'
            }
          },
          data: {
            blockedUntil: blockUntil,
            updatedAt: now,
          }
        });
      }

      return rateLimitResult;
    } catch (error) {
      console.error('Failed to check IP rate limit:', error);
      // Fail open for availability, but log the error
      return {
        isAllowed: true,
        remainingRequests: SECURITY_CONFIG.RATE_LIMIT_IP.MAX_REQUESTS - 1,
        resetTime: new Date(Date.now() + SECURITY_CONFIG.RATE_LIMIT_IP.WINDOW_HOURS * 60 * 60 * 1000),
      };
    }
  }

  /**
   * Creates a security audit log entry
   */
  public async createAuditLog(data: SecurityAuditData): Promise<boolean> {
    try {
      const auditEntry = createAuditLogEntry({
        userId: data.userId,
        email: data.email,
        action: data.action,
        success: data.success,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        additionalDetails: data.details,
      });

      await prisma.securityAuditLog.create({
        data: {
          userId: auditEntry.userId,
          email: auditEntry.email,
          action: auditEntry.action,
          success: auditEntry.success,
          ipAddress: auditEntry.ipAddress,
          userAgent: auditEntry.userAgent,
          details: auditEntry.details as any, // Prisma JSON type
          createdAt: auditEntry.createdAt,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      return false;
    }
  }

  /**
   * Cleanup expired tokens and rate limit entries
   */
  public async performMaintenance(): Promise<{
    expiredTokensDeleted: number;
    expiredRateLimitsDeleted: number;
    oldAuditLogsDeleted: number;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [expiredTokens, expiredEmailLimits, expiredIpLimits, oldAuditLogs] = await Promise.all([
        // Delete expired password reset tokens
        prisma.passwordResetToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { isUsed: true, usedAt: { lt: sevenDaysAgo } },
            ]
          }
        }),

        // Delete old email rate limit entries
        prisma.emailRateLimit.deleteMany({
          where: {
            windowStart: { lt: thirtyDaysAgo }
          }
        }),

        // Delete old IP rate limit entries (but keep blocked IPs until unblocked)
        prisma.ipRateLimit.deleteMany({
          where: {
            AND: [
              { windowStart: { lt: thirtyDaysAgo } },
              {
                OR: [
                  { blockedUntil: null },
                  { blockedUntil: { lt: now } },
                ]
              }
            ]
          }
        }),

        // Delete old audit logs (keep for 90 days)
        prisma.securityAuditLog.deleteMany({
          where: {
            createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
          }
        }),
      ]);

      return {
        expiredTokensDeleted: expiredTokens.count,
        expiredRateLimitsDeleted: expiredEmailLimits.count + expiredIpLimits.count,
        oldAuditLogsDeleted: oldAuditLogs.count,
      };
    } catch (error) {
      console.error('Failed to perform maintenance:', error);
      return {
        expiredTokensDeleted: 0,
        expiredRateLimitsDeleted: 0,
        oldAuditLogsDeleted: 0,
      };
    }
  }

  /**
   * Gets security statistics for monitoring
   */
  public async getSecurityStats(): Promise<{
    activeTokens: number;
    recentFailedAttempts: number;
    blockedIPs: number;
    rateLimitedEmails: number;
  }> {
    try {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      const [activeTokens, failedAttempts, blockedIPs, rateLimitedEmails] = await Promise.all([
        // Count active (unused, non-expired) tokens
        prisma.passwordResetToken.count({
          where: {
            isUsed: false,
            expiresAt: { gte: now }
          }
        }),

        // Count recent failed password reset attempts
        prisma.securityAuditLog.count({
          where: {
            action: { in: ['password_reset_requested', 'password_reset_completed'] },
            success: false,
            createdAt: { gte: lastHour }
          }
        }),

        // Count currently blocked IPs
        prisma.ipRateLimit.count({
          where: {
            blockedUntil: { gt: now }
          }
        }),

        // Count rate-limited emails in current window
        prisma.emailRateLimit.count({
          where: {
            requestCount: { gte: SECURITY_CONFIG.RATE_LIMIT_EMAIL.MAX_REQUESTS },
            windowStart: { gte: getRateLimitWindowStart(SECURITY_CONFIG.RATE_LIMIT_EMAIL.WINDOW_HOURS) }
          }
        }),
      ]);

      return {
        activeTokens: activeTokens,
        recentFailedAttempts: failedAttempts,
        blockedIPs: blockedIPs,
        rateLimitedEmails: rateLimitedEmails,
      };
    } catch (error) {
      console.error('Failed to get security stats:', error);
      return {
        activeTokens: 0,
        recentFailedAttempts: 0,
        blockedIPs: 0,
        rateLimitedEmails: 0,
      };
    }
  }

  /**
   * Revokes all user sessions for security after password reset
   */
  public async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await prisma.session.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      console.error('Failed to revoke user sessions:', error);
      return 0;
    }
  }
}