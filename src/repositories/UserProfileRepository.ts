import { UserProfile, SocialLinks, UserPreferences, LinkedAccount } from "@/models/UserProfile";
import { prisma } from "@/lib/prisma";

export interface ProfileUpdateData {
  bio?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks;
  preferences?: UserPreferences;
}

export interface LinkedAccountData {
  provider: string;
  providerId: string;
  providerEmail?: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata?: Record<string, any>;
}

export class UserProfileRepository {
  private static instance: UserProfileRepository;

  private constructor() {}

  public static getInstance(): UserProfileRepository {
    if (!UserProfileRepository.instance) {
      UserProfileRepository.instance = new UserProfileRepository();
    }
    return UserProfileRepository.instance;
  }

  // Core CRUD operations for user profiles
  public async findById(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
        sessions: true,
        linkedAccounts: {
          where: { isActive: true }
        },
      },
    });
    
    if (!user) return null;
    return this.toDomainModel(user);
  }

  public async findByEmail(email: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
        sessions: true,
        linkedAccounts: {
          where: { isActive: true }
        },
      },
    });
    
    if (!user) return null;
    return this.toDomainModel(user);
  }

  // Profile-specific operations
  public async updateProfile(userId: string, data: ProfileUpdateData): Promise<UserProfile | null> {
    try {
      const updateData: any = {
        ...data,
        lastProfileUpdate: new Date(),
        updatedAt: new Date(),
      };

      // Calculate profile completeness
      if (data.bio !== undefined || data.avatarUrl !== undefined || 
          data.phoneNumber !== undefined || data.dateOfBirth !== undefined ||
          data.location !== undefined || data.website !== undefined ||
          data.socialLinks !== undefined) {
        // Get current user data to calculate completeness
        const currentUser = await this.findById(userId);
        if (currentUser) {
          const updatedProfile = { ...currentUser, ...data };
          const tempProfile = UserProfile.fromJSON(updatedProfile);
          updateData.profileCompleteness = tempProfile.calculateProfileCompleteness();
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          accounts: true,
          sessions: true,
          linkedAccounts: {
            where: { isActive: true }
          },
        },
      });

      return this.toDomainModel(user);
    } catch (error) {
      console.error('Error updating profile:', error);
      return null;
    }
  }

  // Avatar management
  public async updateAvatar(userId: string, avatarUrl: string): Promise<UserProfile | null> {
    return this.updateProfile(userId, { avatarUrl });
  }

  public async deleteAvatar(userId: string): Promise<UserProfile | null> {
    return this.updateProfile(userId, { avatarUrl: undefined });
  }

  // Social links management
  public async updateSocialLinks(userId: string, socialLinks: SocialLinks): Promise<UserProfile | null> {
    return this.updateProfile(userId, { socialLinks });
  }

  public async addSocialLink(userId: string, platform: string, url: string): Promise<UserProfile | null> {
    const currentProfile = await this.findById(userId);
    if (!currentProfile) return null;

    const updatedSocialLinks = {
      ...currentProfile.socialLinks,
      [platform]: url
    };

    return this.updateSocialLinks(userId, updatedSocialLinks);
  }

  public async removeSocialLink(userId: string, platform: string): Promise<UserProfile | null> {
    const currentProfile = await this.findById(userId);
    if (!currentProfile) return null;

    const updatedSocialLinks = { ...currentProfile.socialLinks };
    delete updatedSocialLinks[platform];

    return this.updateSocialLinks(userId, updatedSocialLinks);
  }

  // Preferences management
  public async updatePreferences(userId: string, preferences: UserPreferences): Promise<UserProfile | null> {
    const currentProfile = await this.findById(userId);
    if (!currentProfile) return null;

    const updatedPreferences = {
      ...currentProfile.preferences,
      ...preferences
    };

    return this.updateProfile(userId, { preferences: updatedPreferences });
  }

  public async updatePreference<K extends keyof UserPreferences>(
    userId: string,
    key: K,
    value: UserPreferences[K]
  ): Promise<UserProfile | null> {
    const currentProfile = await this.findById(userId);
    if (!currentProfile) return null;

    const updatedPreferences = {
      ...currentProfile.preferences,
      [key]: value
    };

    return this.updateProfile(userId, { preferences: updatedPreferences });
  }

  // OAuth account linking
  public async linkAccount(userId: string, accountData: LinkedAccountData): Promise<LinkedAccount | null> {
    try {
      // First, deactivate any existing account for the same provider
      await prisma.linkedAccount.updateMany({
        where: {
          userId,
          provider: accountData.provider,
        },
        data: {
          isActive: false,
        },
      });

      // Create new linked account
      const linkedAccount = await prisma.linkedAccount.create({
        data: {
          userId,
          ...accountData,
          linkedAt: new Date(),
          isActive: true,
        },
      });

      return {
        id: linkedAccount.id,
        provider: linkedAccount.provider,
        providerId: linkedAccount.providerId,
        providerEmail: linkedAccount.providerEmail || undefined,
        displayName: linkedAccount.displayName || undefined,
        profileUrl: linkedAccount.profileUrl || undefined,
        avatarUrl: linkedAccount.avatarUrl || undefined,
        isActive: linkedAccount.isActive,
        linkedAt: linkedAccount.linkedAt,
        lastSyncAt: linkedAccount.lastSyncAt || undefined,
      };
    } catch (error) {
      console.error('Error linking account:', error);
      return null;
    }
  }

  public async unlinkAccount(userId: string, provider: string): Promise<boolean> {
    try {
      await prisma.linkedAccount.updateMany({
        where: {
          userId,
          provider,
        },
        data: {
          isActive: false,
        },
      });
      return true;
    } catch (error) {
      console.error('Error unlinking account:', error);
      return false;
    }
  }

  public async getLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
    const accounts = await prisma.linkedAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    return accounts.map(acc => ({
      id: acc.id,
      provider: acc.provider,
      providerId: acc.providerId,
      providerEmail: acc.providerEmail || undefined,
      displayName: acc.displayName || undefined,
      profileUrl: acc.profileUrl || undefined,
      avatarUrl: acc.avatarUrl || undefined,
      isActive: acc.isActive,
      linkedAt: acc.linkedAt,
      lastSyncAt: acc.lastSyncAt || undefined,
    }));
  }

  public async getLinkedAccount(userId: string, provider: string): Promise<LinkedAccount | null> {
    const account = await prisma.linkedAccount.findFirst({
      where: {
        userId,
        provider,
        isActive: true,
      },
    });

    if (!account) return null;

    return {
      id: account.id,
      provider: account.provider,
      providerId: account.providerId,
      providerEmail: account.providerEmail || undefined,
      displayName: account.displayName || undefined,
      profileUrl: account.profileUrl || undefined,
      avatarUrl: account.avatarUrl || undefined,
      isActive: account.isActive,
      linkedAt: account.linkedAt,
      lastSyncAt: account.lastSyncAt || undefined,
    };
  }

  // Profile statistics and insights
  public async getProfileStats(userId: string): Promise<{
    completeness: number;
    linkedAccountsCount: number;
    lastUpdated: Date | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        linkedAccounts: {
          where: { isActive: true }
        }
      }
    });

    if (!user) {
      return {
        completeness: 0,
        linkedAccountsCount: 0,
        lastUpdated: null,
      };
    }

    return {
      completeness: user.profileCompleteness,
      linkedAccountsCount: user.linkedAccounts.length,
      lastUpdated: user.lastProfileUpdate,
    };
  }

  // Search and filtering
  public async findProfilesByCompleteness(minCompleteness: number, limit: number = 50): Promise<UserProfile[]> {
    const users = await prisma.user.findMany({
      where: {
        profileCompleteness: {
          gte: minCompleteness,
        },
        isActive: true,
      },
      include: {
        accounts: true,
        sessions: true,
        linkedAccounts: {
          where: { isActive: true }
        },
      },
      orderBy: {
        profileCompleteness: 'desc',
      },
      take: limit,
    });

    return users.map(this.toDomainModel);
  }

  public async findPublicProfiles(limit: number = 50): Promise<UserProfile[]> {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        preferences: {
          path: ['privacySettings', 'profileVisibility'],
          not: 'private',
        },
      },
      include: {
        accounts: true,
        sessions: true,
        linkedAccounts: {
          where: { isActive: true }
        },
      },
      orderBy: {
        lastProfileUpdate: 'desc',
      },
      take: limit,
    });

    return users.map(this.toDomainModel);
  }

  // Bulk operations
  public async recalculateAllProfileCompleteness(): Promise<number> {
    const users = await prisma.user.findMany({
      include: {
        linkedAccounts: {
          where: { isActive: true }
        },
      },
    });

    let updatedCount = 0;

    for (const user of users) {
      const profile = this.toDomainModel(user);
      const completeness = profile.calculateProfileCompleteness();

      if (completeness !== user.profileCompleteness) {
        await prisma.user.update({
          where: { id: user.id },
          data: { profileCompleteness: completeness },
        });
        updatedCount++;
      }
    }

    return updatedCount;
  }

  // Helper method to convert Prisma model to domain model
  private toDomainModel(prismaUser: any): UserProfile {
    return UserProfile.fromPrismaModel({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name || "",
      emailVerified: prismaUser.emailVerified,
      image: prismaUser.image,
      phone: prismaUser.phone ? parseInt(prismaUser.phone) : undefined,
      twoFactorEnabled: prismaUser.twoFactorEnabled,
      isActive: prismaUser.isActive,
      role: prismaUser.role,
      stripeCustomerId: prismaUser.stripeCustomerId,
      preferredCurrency: prismaUser.preferredCurrency,
      timezone: prismaUser.timezone,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      lastLoginAt: prismaUser.lastLoginAt,
      bio: prismaUser.bio,
      avatarUrl: prismaUser.avatarUrl,
      phoneNumber: prismaUser.phoneNumber,
      dateOfBirth: prismaUser.dateOfBirth,
      location: prismaUser.location,
      website: prismaUser.website,
      socialLinks: prismaUser.socialLinks,
      preferences: prismaUser.preferences,
      lastProfileUpdate: prismaUser.lastProfileUpdate,
      profileCompleteness: prismaUser.profileCompleteness,
      linkedAccounts: (prismaUser.linkedAccounts || []).map((acc: any) => ({
        id: acc.id,
        provider: acc.provider,
        providerId: acc.providerId,
        providerEmail: acc.providerEmail,
        displayName: acc.displayName,
        profileUrl: acc.profileUrl,
        avatarUrl: acc.avatarUrl,
        isActive: acc.isActive,
        linkedAt: acc.linkedAt,
        lastSyncAt: acc.lastSyncAt,
      })),
    });
  }

  // Validation helpers
  public async validateUniquePhoneNumber(userId: string, phoneNumber: string): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
      where: {
        phoneNumber,
        id: {
          not: userId,
        },
      },
    });
    
    return !existingUser;
  }

  public async validateUniqueWebsite(userId: string, website: string): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
      where: {
        website,
        id: {
          not: userId,
        },
      },
    });
    
    return !existingUser;
  }

  // Cleanup operations
  public async cleanupInactiveLinkedAccounts(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.linkedAccount.deleteMany({
      where: {
        isActive: false,
        linkedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}