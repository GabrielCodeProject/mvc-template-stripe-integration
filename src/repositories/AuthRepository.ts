import { prisma } from '@/lib/prisma';
import { AuthUser } from '@/models/AuthUser';

export class AuthRepository {
  private static instance: AuthRepository;

  private constructor() {}

  public static getInstance(): AuthRepository {
    if (!AuthRepository.instance) {
      AuthRepository.instance = new AuthRepository();
    }
    return AuthRepository.instance;
  }

  // Find user by email with accounts
  public async findByEmail(email: string): Promise<AuthUser | null> {
    const userData = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return userData ? AuthUser.fromPrismaModel(userData) : null;
  }

  // Find user by ID with accounts
  public async findById(id: string): Promise<AuthUser | null> {
    const userData = await prisma.user.findUnique({
      where: { id },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return userData ? AuthUser.fromPrismaModel(userData) : null;
  }

  // Find user by verification token
  public async findByVerificationToken(token: string): Promise<AuthUser | null> {
    const userData = await prisma.user.findFirst({
      where: {
        accounts: {
          some: {
            verificationToken: token,
            providerId: 'credentials'
          }
        }
      },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return userData ? AuthUser.fromPrismaModel(userData) : null;
  }

  // Find user by reset token
  public async findByResetToken(token: string): Promise<AuthUser | null> {
    const userData = await prisma.user.findFirst({
      where: {
        accounts: {
          some: {
            resetToken: token,
            resetTokenExpiresAt: {
              gte: new Date()
            },
            providerId: 'credentials'
          }
        }
      },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return userData ? AuthUser.fromPrismaModel(userData) : null;
  }

  // Create user with credentials account
  public async createWithPassword(
    email: string,
    passwordHash: string,
    name: string,
    verificationToken?: string
  ): Promise<AuthUser> {
    const userData = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: !verificationToken, // If no verification token, mark as verified
        accounts: {
          create: {
            providerId: 'credentials',
            accountId: email,
            password: passwordHash,
            verificationToken,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return AuthUser.fromPrismaModel(userData);
  }

  // Create OAuth user
  public async createWithOAuth(
    email: string,
    name: string,
    providerId: string,
    providerAccountId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<AuthUser> {
    const userData = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: true, // OAuth emails are considered verified
        accounts: {
          create: {
            providerId,
            accountId: providerAccountId,
            accessToken,
            refreshToken,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return AuthUser.fromPrismaModel(userData);
  }

  // Update user password
  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
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
  }

  // Save verification token
  public async saveVerificationToken(userId: string, token: string): Promise<void> {
    await prisma.account.updateMany({
      where: {
        userId,
        providerId: 'credentials'
      },
      data: {
        verificationToken: token,
        updatedAt: new Date()
      }
    });
  }

  // Clear verification token (email verified)
  public async clearVerificationToken(userId: string): Promise<void> {
    await Promise.all([
      // Clear verification token
      prisma.account.updateMany({
        where: {
          userId,
          providerId: 'credentials'
        },
        data: {
          verificationToken: null,
          updatedAt: new Date()
        }
      }),
      // Mark email as verified
      prisma.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          updatedAt: new Date()
        }
      })
    ]);
  }

  // Save reset token
  public async saveResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await prisma.account.updateMany({
      where: {
        userId,
        providerId: 'credentials'
      },
      data: {
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date()
      }
    });
  }

  // Clear reset token
  public async clearResetToken(userId: string): Promise<void> {
    await prisma.account.updateMany({
      where: {
        userId,
        providerId: 'credentials'
      },
      data: {
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date()
      }
    });
  }

  // Update 2FA settings
  public async updateTwoFactor(
    userId: string,
    twoFactorSecret?: string,
    backupCodes?: string[],
    enabled?: boolean
  ): Promise<void> {
    const updates: any = { updatedAt: new Date() };
    
    if (twoFactorSecret !== undefined) updates.twoFactorSecret = twoFactorSecret;
    if (backupCodes !== undefined) updates.backupCodes = backupCodes;

    await Promise.all([
      // Update account
      prisma.account.updateMany({
        where: {
          userId,
          providerId: 'credentials'
        },
        data: updates
      }),
      // Update user if enabled status changed
      enabled !== undefined ? prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: enabled,
          updatedAt: new Date()
        }
      }) : Promise.resolve()
    ]);
  }

  // Update last login
  public async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  // Check if email exists
  public async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    
    return !!user;
  }

  // Update user profile
  public async updateProfile(
    userId: string,
    updates: {
      name?: string;
      phone?: string;
      timezone?: string;
      preferredCurrency?: string;
      image?: string;
    }
  ): Promise<AuthUser> {
    const userData = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updates,
        updatedAt: new Date()
      },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return AuthUser.fromPrismaModel(userData);
  }

  // Delete user (cascade will handle accounts and sessions)
  public async deleteUser(userId: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id: userId }
      });
      return true;
    } catch {
      return false;
    }
  }

  // Clean up expired reset tokens
  public async cleanupExpiredResetTokens(): Promise<number> {
    const result = await prisma.account.updateMany({
      where: {
        resetTokenExpiresAt: {
          lt: new Date()
        }
      },
      data: {
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date()
      }
    });
    
    return result.count;
  }
}