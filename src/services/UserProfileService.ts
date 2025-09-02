import { UserProfile, SocialLinks, UserPreferences, LinkedAccount } from "@/models/UserProfile";
import { UserProfileRepository, ProfileUpdateData, LinkedAccountData } from "@/repositories/UserProfileRepository";
import { SecurityAuditLogService, AuditLogContext } from "@/services/SecurityAuditLogService";
import { SecurityAction } from "@/models/SecurityAuditLog";
import crypto from "crypto";

export interface FileUploadConfig {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  uploadPath: string;
  publicUrl: string;
}

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ProfileUpdateResult {
  success: boolean;
  profile?: UserProfile;
  errors?: string[];
  warnings?: string[];
}

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl?: string;
  errors?: string[];
}

export class UserProfileService {
  private repository: UserProfileRepository;
  private auditService: SecurityAuditLogService;
  private static instance: UserProfileService;

  // Configuration
  private fileUploadConfig: FileUploadConfig = {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/gif'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    uploadPath: '/uploads/avatars',
    publicUrl: '/api/uploads/avatars'
  };

  // Rate limiting for profile updates
  private updateAttempts = new Map<string, { count: number; resetTime: number }>();
  private readonly maxUpdatesPerHour = 10;

  private constructor() {
    this.repository = UserProfileRepository.getInstance();
    this.auditService = SecurityAuditLogService.getInstance();
  }

  public static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  // Core profile management methods
  public async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const profile = await this.repository.findById(userId);
      
      if (profile) {
        await this.auditService.logDataAccessEvent(
          SecurityAction.PROFILE_VIEW,
          {
            userId,
            resource: `profile:${userId}`,
          }
        );
      }

      return profile;
    } catch (error) {
      console.error('Error retrieving profile:', error);
      await this.auditService.logDataAccessEvent(
        SecurityAction.PROFILE_VIEW,
        {
          userId,
          resource: `profile:${userId}`,
          eventData: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
        false
      );
      return null;
    }
  }

  public async updateProfile(
    userId: string,
    updates: ProfileUpdateData,
    context?: AuditLogContext
  ): Promise<ProfileUpdateResult> {
    try {
      // Rate limiting check
      if (!this.checkUpdateRateLimit(userId)) {
        return {
          success: false,
          errors: ['Too many profile updates. Please wait before trying again.'],
        };
      }

      // Validate the updates
      const validation = await this.validateProfileUpdate(userId, updates);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      // Get current profile for comparison
      const currentProfile = await this.repository.findById(userId);
      if (!currentProfile) {
        return {
          success: false,
          errors: ['Profile not found'],
        };
      }

      // Apply updates
      const updatedProfile = await this.repository.updateProfile(userId, updates);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to update profile'],
        };
      }

      // Record rate limit attempt
      this.recordUpdateAttempt(userId);

      // Log the profile update
      await this.auditService.logUserManagementEvent(
        SecurityAction.PROFILE_UPDATE,
        {
          userId,
          resource: `profile:${userId}`,
          eventData: {
            updatedFields: Object.keys(updates),
            previousCompleteness: currentProfile.profileCompleteness,
            newCompleteness: updatedProfile.profileCompleteness,
          },
          ...context,
        }
      );

      return {
        success: true,
        profile: updatedProfile,
        warnings: validation.warnings,
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      
      await this.auditService.logUserManagementEvent(
        SecurityAction.PROFILE_UPDATE,
        {
          userId,
          resource: `profile:${userId}`,
          eventData: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedFields: Object.keys(updates),
          },
          ...context,
        },
        false
      );

      return {
        success: false,
        errors: ['An error occurred while updating the profile'],
      };
    }
  }

  // Avatar management
  public async prepareAvatarUpload(
    userId: string,
    file: { name: string; size: number; type: string }
  ): Promise<{
    success: boolean;
    uploadUrl?: string;
    errors?: string[];
  }> {
    try {
      // Validate file
      const validation = this.validateAvatarFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Generate secure upload URL
      const fileId = crypto.randomUUID();
      const extension = this.getFileExtension(file.name);
      const fileName = `${userId}-${fileId}${extension}`;
      const uploadUrl = `${this.fileUploadConfig.publicUrl}/${fileName}`;

      await this.auditService.logDataAccessEvent(
        SecurityAction.AVATAR_UPLOAD_INITIATED,
        {
          userId,
          resource: `avatar:${userId}`,
          eventData: {
            fileName,
            fileSize: file.size,
            mimeType: file.type,
          },
        }
      );

      return {
        success: true,
        uploadUrl,
      };
    } catch (error) {
      console.error('Error preparing avatar upload:', error);
      return {
        success: false,
        errors: ['Failed to prepare avatar upload'],
      };
    }
  }

  public async updateAvatar(
    userId: string,
    avatarUrl: string,
    context?: AuditLogContext
  ): Promise<AvatarUploadResult> {
    try {
      // Validate URL
      if (!this.isValidUrl(avatarUrl)) {
        return {
          success: false,
          errors: ['Invalid avatar URL'],
        };
      }

      const updatedProfile = await this.repository.updateAvatar(userId, avatarUrl);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to update avatar'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.AVATAR_UPDATE,
        {
          userId,
          resource: `avatar:${userId}`,
          eventData: { avatarUrl },
          ...context,
        }
      );

      return {
        success: true,
        avatarUrl,
      };
    } catch (error) {
      console.error('Error updating avatar:', error);
      
      await this.auditService.logUserManagementEvent(
        SecurityAction.AVATAR_UPDATE,
        {
          userId,
          resource: `avatar:${userId}`,
          eventData: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            avatarUrl,
          },
          ...context,
        },
        false
      );

      return {
        success: false,
        errors: ['Failed to update avatar'],
      };
    }
  }

  public async deleteAvatar(userId: string, context?: AuditLogContext): Promise<ProfileUpdateResult> {
    try {
      const updatedProfile = await this.repository.deleteAvatar(userId);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to delete avatar'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.AVATAR_DELETE,
        {
          userId,
          resource: `avatar:${userId}`,
          ...context,
        }
      );

      return {
        success: true,
        profile: updatedProfile,
      };
    } catch (error) {
      console.error('Error deleting avatar:', error);
      
      await this.auditService.logUserManagementEvent(
        SecurityAction.AVATAR_DELETE,
        {
          userId,
          resource: `avatar:${userId}`,
          eventData: { error: error instanceof Error ? error.message : 'Unknown error' },
          ...context,
        },
        false
      );

      return {
        success: false,
        errors: ['Failed to delete avatar'],
      };
    }
  }

  // Social links management
  public async updateSocialLinks(
    userId: string,
    socialLinks: SocialLinks,
    context?: AuditLogContext
  ): Promise<ProfileUpdateResult> {
    try {
      // Validate all URLs
      const validation = this.validateSocialLinks(socialLinks);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      const updatedProfile = await this.repository.updateSocialLinks(userId, socialLinks);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to update social links'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.PROFILE_UPDATE,
        {
          userId,
          resource: `profile:${userId}:socialLinks`,
          eventData: {
            platforms: Object.keys(socialLinks),
            linkCount: Object.keys(socialLinks).length,
          },
          ...context,
        }
      );

      return {
        success: true,
        profile: updatedProfile,
      };
    } catch (error) {
      console.error('Error updating social links:', error);
      return {
        success: false,
        errors: ['Failed to update social links'],
      };
    }
  }

  public async addSocialLink(
    userId: string,
    platform: string,
    url: string,
    context?: AuditLogContext
  ): Promise<ProfileUpdateResult> {
    try {
      if (!this.isValidUrl(url)) {
        return {
          success: false,
          errors: [`Invalid URL for ${platform}`],
        };
      }

      const updatedProfile = await this.repository.addSocialLink(userId, platform, url);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to add social link'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.PROFILE_UPDATE,
        {
          userId,
          resource: `profile:${userId}:socialLinks:${platform}`,
          eventData: { platform, url },
          ...context,
        }
      );

      return {
        success: true,
        profile: updatedProfile,
      };
    } catch (error) {
      console.error('Error adding social link:', error);
      return {
        success: false,
        errors: ['Failed to add social link'],
      };
    }
  }

  public async removeSocialLink(
    userId: string,
    platform: string,
    context?: AuditLogContext
  ): Promise<ProfileUpdateResult> {
    try {
      const updatedProfile = await this.repository.removeSocialLink(userId, platform);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to remove social link'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.PROFILE_UPDATE,
        {
          userId,
          resource: `profile:${userId}:socialLinks:${platform}`,
          eventData: { platform, action: 'removed' },
          ...context,
        }
      );

      return {
        success: true,
        profile: updatedProfile,
      };
    } catch (error) {
      console.error('Error removing social link:', error);
      return {
        success: false,
        errors: ['Failed to remove social link'],
      };
    }
  }

  // Preferences management
  public async updatePreferences(
    userId: string,
    preferences: UserPreferences,
    context?: AuditLogContext
  ): Promise<ProfileUpdateResult> {
    try {
      const validation = this.validatePreferences(preferences);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      const updatedProfile = await this.repository.updatePreferences(userId, preferences);
      if (!updatedProfile) {
        return {
          success: false,
          errors: ['Failed to update preferences'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.PROFILE_UPDATE,
        {
          userId,
          resource: `profile:${userId}:preferences`,
          eventData: {
            updatedPreferences: Object.keys(preferences),
          },
          ...context,
        }
      );

      return {
        success: true,
        profile: updatedProfile,
      };
    } catch (error) {
      console.error('Error updating preferences:', error);
      return {
        success: false,
        errors: ['Failed to update preferences'],
      };
    }
  }

  // OAuth account linking
  public async linkAccount(
    userId: string,
    accountData: LinkedAccountData,
    context?: AuditLogContext
  ): Promise<{
    success: boolean;
    linkedAccount?: LinkedAccount;
    errors?: string[];
  }> {
    try {
      // Validate account data
      const validation = this.validateLinkedAccountData(accountData);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      const linkedAccount = await this.repository.linkAccount(userId, accountData);
      if (!linkedAccount) {
        return {
          success: false,
          errors: ['Failed to link account'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.OAUTH_LINK,
        {
          userId,
          resource: `linkedAccount:${userId}:${accountData.provider}`,
          eventData: {
            provider: accountData.provider,
            providerId: accountData.providerId,
            providerEmail: accountData.providerEmail,
          },
          ...context,
        }
      );

      return {
        success: true,
        linkedAccount,
      };
    } catch (error) {
      console.error('Error linking account:', error);
      
      await this.auditService.logUserManagementEvent(
        SecurityAction.OAUTH_LINK,
        {
          userId,
          resource: `linkedAccount:${userId}:${accountData.provider}`,
          eventData: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            provider: accountData.provider,
          },
          ...context,
        },
        false
      );

      return {
        success: false,
        errors: ['Failed to link account'],
      };
    }
  }

  public async unlinkAccount(
    userId: string,
    provider: string,
    context?: AuditLogContext
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const success = await this.repository.unlinkAccount(userId, provider);
      if (!success) {
        return {
          success: false,
          errors: ['Failed to unlink account'],
        };
      }

      await this.auditService.logUserManagementEvent(
        SecurityAction.OAUTH_UNLINK,
        {
          userId,
          resource: `linkedAccount:${userId}:${provider}`,
          eventData: { provider },
          ...context,
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Error unlinking account:', error);
      
      await this.auditService.logUserManagementEvent(
        SecurityAction.OAUTH_UNLINK,
        {
          userId,
          resource: `linkedAccount:${userId}:${provider}`,
          eventData: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            provider,
          },
          ...context,
        },
        false
      );

      return {
        success: false,
        errors: ['Failed to unlink account'],
      };
    }
  }

  // Profile statistics and insights
  public async getProfileStats(userId: string): Promise<{
    completeness: number;
    linkedAccountsCount: number;
    lastUpdated: Date | null;
    recommendations: string[];
  } | null> {
    try {
      const stats = await this.repository.getProfileStats(userId);
      const recommendations = this.generateProfileRecommendations(stats.completeness);

      return {
        ...stats,
        recommendations,
      };
    } catch (error) {
      console.error('Error retrieving profile stats:', error);
      return null;
    }
  }

  // Validation methods
  private async validateProfileUpdate(
    userId: string,
    updates: ProfileUpdateData
  ): Promise<ProfileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Bio validation
    if (updates.bio !== undefined) {
      if (updates.bio && updates.bio.length > 500) {
        errors.push('Bio must be 500 characters or less');
      }
      if (updates.bio && this.containsInappropriateContent(updates.bio)) {
        errors.push('Bio contains inappropriate content');
      }
    }

    // Phone number validation
    if (updates.phoneNumber !== undefined && updates.phoneNumber) {
      const isUnique = await this.repository.validateUniquePhoneNumber(userId, updates.phoneNumber);
      if (!isUnique) {
        errors.push('Phone number is already in use');
      }
    }

    // Website validation
    if (updates.website !== undefined && updates.website) {
      if (!this.isValidUrl(updates.website)) {
        errors.push('Invalid website URL');
      }
      const isUnique = await this.repository.validateUniqueWebsite(userId, updates.website);
      if (!isUnique) {
        warnings.push('Website URL is already used by another user');
      }
    }

    // Date of birth validation
    if (updates.dateOfBirth !== undefined && updates.dateOfBirth) {
      const age = this.calculateAge(updates.dateOfBirth);
      if (age < 13) {
        errors.push('Must be at least 13 years old');
      }
      if (age > 120) {
        errors.push('Invalid date of birth');
      }
    }

    // Location validation
    if (updates.location !== undefined && updates.location && updates.location.length > 100) {
      errors.push('Location must be 100 characters or less');
    }

    // Social links validation
    if (updates.socialLinks !== undefined) {
      const socialValidation = this.validateSocialLinks(updates.socialLinks);
      errors.push(...socialValidation.errors);
    }

    // Preferences validation
    if (updates.preferences !== undefined) {
      const prefValidation = this.validatePreferences(updates.preferences);
      errors.push(...prefValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateAvatarFile(file: { name: string; size: number; type: string }): ProfileValidationResult {
    const errors: string[] = [];

    // Size validation
    if (file.size > this.fileUploadConfig.maxSizeBytes) {
      errors.push(`File size must be less than ${this.fileUploadConfig.maxSizeBytes / (1024 * 1024)}MB`);
    }

    // Type validation
    if (!this.fileUploadConfig.allowedMimeTypes.includes(file.type)) {
      errors.push('File type not supported. Please use JPG, PNG, WebP, or GIF');
    }

    // Extension validation
    const extension = this.getFileExtension(file.name).toLowerCase();
    if (!this.fileUploadConfig.allowedExtensions.includes(extension)) {
      errors.push('File extension not supported');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateSocialLinks(socialLinks: SocialLinks): ProfileValidationResult {
    const errors: string[] = [];

    for (const [platform, url] of Object.entries(socialLinks)) {
      if (url && !this.isValidUrl(url)) {
        errors.push(`Invalid URL for ${platform}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validatePreferences(preferences: UserPreferences): ProfileValidationResult {
    const errors: string[] = [];

    // Theme validation
    if (preferences.theme && !['light', 'dark', 'system'].includes(preferences.theme)) {
      errors.push('Invalid theme selection');
    }

    // Language validation
    if (preferences.language && preferences.language.length > 10) {
      errors.push('Invalid language code');
    }

    // Timezone validation
    if (preferences.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: preferences.timezone });
      } catch {
        errors.push('Invalid timezone');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateLinkedAccountData(data: LinkedAccountData): ProfileValidationResult {
    const errors: string[] = [];

    if (!data.provider || data.provider.trim().length === 0) {
      errors.push('Provider is required');
    }

    if (!data.providerId || data.providerId.trim().length === 0) {
      errors.push('Provider ID is required');
    }

    if (data.providerEmail && !this.isValidEmail(data.providerEmail)) {
      errors.push('Invalid provider email');
    }

    if (data.profileUrl && !this.isValidUrl(data.profileUrl)) {
      errors.push('Invalid profile URL');
    }

    if (data.avatarUrl && !this.isValidUrl(data.avatarUrl)) {
      errors.push('Invalid avatar URL');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Rate limiting
  private checkUpdateRateLimit(userId: string): boolean {
    const now = Date.now();
    const userAttempts = this.updateAttempts.get(userId);

    if (!userAttempts || now > userAttempts.resetTime) {
      return true; // No attempts or window has reset
    }

    return userAttempts.count < this.maxUpdatesPerHour;
  }

  private recordUpdateAttempt(userId: string): void {
    const now = Date.now();
    const resetTime = now + (60 * 60 * 1000); // 1 hour from now
    const userAttempts = this.updateAttempts.get(userId);

    if (!userAttempts || now > userAttempts.resetTime) {
      this.updateAttempts.set(userId, { count: 1, resetTime });
    } else {
      userAttempts.count++;
    }
  }

  // Helper methods
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getFileExtension(filename: string): string {
    return filename.substring(filename.lastIndexOf('.')).toLowerCase();
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }

    return age;
  }

  private containsInappropriateContent(text: string): boolean {
    // Basic profanity/inappropriate content check
    // In a real implementation, you'd use a more sophisticated content filtering service
    const inappropriateWords = [
      // Add your inappropriate words list here
      'spam', 'scam'
    ];

    const lowerText = text.toLowerCase();
    return inappropriateWords.some(word => lowerText.includes(word));
  }

  private generateProfileRecommendations(completeness: number): string[] {
    const recommendations: string[] = [];

    if (completeness < 30) {
      recommendations.push('Add a profile photo to make your profile more personable');
      recommendations.push('Write a bio to tell others about yourself');
    }

    if (completeness < 50) {
      recommendations.push('Add your location to connect with people nearby');
      recommendations.push('Link your social media accounts');
    }

    if (completeness < 80) {
      recommendations.push('Add your website or portfolio');
      recommendations.push('Complete your contact information');
    }

    if (completeness >= 80) {
      recommendations.push('Your profile looks great! Keep it updated');
    }

    return recommendations;
  }

  // Configuration methods
  public setFileUploadConfig(config: Partial<FileUploadConfig>): void {
    this.fileUploadConfig = { ...this.fileUploadConfig, ...config };
  }

  public getFileUploadConfig(): FileUploadConfig {
    return { ...this.fileUploadConfig };
  }
}