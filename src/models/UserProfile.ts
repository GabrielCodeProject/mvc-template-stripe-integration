import { User } from "./User";
import { IEntity } from "../repositories/BaseRepository";

// Social links structure
export interface SocialLinks {
  twitter?: string;
  linkedin?: string;
  github?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  website?: string;
  [key: string]: string | undefined;
}

// User preferences structure
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  emailNotifications?: {
    marketing?: boolean;
    security?: boolean;
    updates?: boolean;
    digest?: boolean;
    frequency?: 'instant' | 'hourly' | 'daily' | 'weekly' | 'never';
  };
  pushNotifications?: {
    enabled?: boolean;
    categories?: {
      security?: boolean;
      updates?: boolean;
      social?: boolean;
    };
  };
  privacySettings?: {
    profileVisibility?: 'public' | 'private' | 'friends';
    showEmail?: boolean;
    showPhone?: boolean;
    showBirthDate?: boolean;
    showLocation?: boolean;
    showSocialLinks?: boolean;
    showActivityStatus?: boolean;
    searchEngineIndexing?: boolean;
  };
  displaySettings?: {
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
    currency?: string;
  };
  accessibilitySettings?: {
    highContrast?: boolean;
    largeText?: boolean;
    reducedMotion?: boolean;
  };
  regionalSettings?: {
    country?: string;
    distanceUnit?: 'miles' | 'kilometers';
    numberFormat?: 'us' | 'eu' | 'space';
  };
}

// Linked account structure
export interface LinkedAccount {
  id: string;
  provider: string;
  providerId: string;
  providerEmail?: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  isActive: boolean;
  linkedAt: Date;
  lastSyncAt?: Date;
}

// Extended constructor params including profile fields
interface UserProfileConstructorParams {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  image?: string;
  phone?: number;
  twoFactorEnabled?: boolean;
  isActive?: boolean;
  role?: string;
  stripeCustomerId?: string;
  preferredCurrency?: string;
  timezone?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  accounts?: any[];
  sessions?: any[];
  // Profile fields
  bio?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks | null;
  preferences?: UserPreferences | null;
  lastProfileUpdate?: Date;
  profileCompleteness?: number;
  linkedAccounts?: LinkedAccount[];
}

export class UserProfile extends User implements IEntity {
  private _bio?: string;
  private _avatarUrl?: string;
  private _phoneNumber?: string;
  private _dateOfBirth?: Date;
  private _location?: string;
  private _website?: string;
  private _socialLinks?: SocialLinks;
  private _preferences?: UserPreferences;
  private _lastProfileUpdate?: Date;
  private _profileCompleteness: number;
  private _linkedAccounts: LinkedAccount[];

  constructor(params: UserProfileConstructorParams) {
    super(params);
    this._bio = params.bio;
    this._avatarUrl = params.avatarUrl;
    this._phoneNumber = params.phoneNumber;
    this._dateOfBirth = params.dateOfBirth;
    this._location = params.location;
    this._website = params.website;
    this._socialLinks = params.socialLinks || {};
    this._preferences = params.preferences || {};
    this._lastProfileUpdate = params.lastProfileUpdate;
    this._profileCompleteness = params.profileCompleteness || 0;
    this._linkedAccounts = params.linkedAccounts || [];
  }

  // Profile field getters and setters
  get bio(): string | undefined {
    return this._bio;
  }

  set bio(value: string | undefined) {
    if (value) {
      // Basic XSS prevention - sanitize HTML and limit length
      this._bio = this.sanitizeText(value, 500);
    } else {
      this._bio = undefined;
    }
    this.updateProfileTimestamp();
  }

  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }

  set avatarUrl(value: string | undefined) {
    if (value && !this.isValidUrl(value)) {
      throw new Error("Invalid avatar URL format");
    }
    this._avatarUrl = value;
    this.updateProfileTimestamp();
  }

  get phoneNumber(): string | undefined {
    return this._phoneNumber;
  }

  set phoneNumber(value: string | undefined) {
    if (value) {
      const sanitized = this.sanitizePhoneNumber(value);
      if (!this.isValidPhoneNumber(sanitized)) {
        throw new Error("Invalid phone number format");
      }
      this._phoneNumber = sanitized;
    } else {
      this._phoneNumber = undefined;
    }
    this.updateProfileTimestamp();
  }

  get dateOfBirth(): Date | undefined {
    return this._dateOfBirth;
  }

  set dateOfBirth(value: Date | undefined) {
    if (value) {
      // Validate age (must be at least 13, not in future)
      const now = new Date();
      const age = now.getFullYear() - value.getFullYear();
      if (age < 13 || value > now) {
        throw new Error("Invalid date of birth");
      }
    }
    this._dateOfBirth = value;
    this.updateProfileTimestamp();
  }

  get location(): string | undefined {
    return this._location;
  }

  set location(value: string | undefined) {
    if (value) {
      this._location = this.sanitizeText(value, 100);
    } else {
      this._location = undefined;
    }
    this.updateProfileTimestamp();
  }

  get website(): string | undefined {
    return this._website;
  }

  set website(value: string | undefined) {
    if (value) {
      if (!this.isValidUrl(value)) {
        throw new Error("Invalid website URL format");
      }
      this._website = value;
    } else {
      this._website = undefined;
    }
    this.updateProfileTimestamp();
  }

  get socialLinks(): SocialLinks {
    return this._socialLinks || {};
  }

  set socialLinks(value: SocialLinks) {
    // Validate all URLs in social links
    const validatedLinks: SocialLinks = {};
    for (const [platform, url] of Object.entries(value)) {
      if (url && this.isValidUrl(url)) {
        validatedLinks[platform] = url;
      }
    }
    this._socialLinks = validatedLinks;
    this.updateProfileTimestamp();
  }

  get preferences(): UserPreferences {
    return this._preferences || {};
  }

  set preferences(value: UserPreferences) {
    this._preferences = { ...this._preferences, ...value };
    this.updateProfileTimestamp();
  }

  get lastProfileUpdate(): Date | undefined {
    return this._lastProfileUpdate;
  }

  get profileCompleteness(): number {
    return this._profileCompleteness;
  }

  get linkedAccounts(): LinkedAccount[] {
    return this._linkedAccounts;
  }

  // Profile management methods
  public updateProfile(updates: Partial<UserProfileConstructorParams>): void {
    if (updates.bio !== undefined) this.bio = updates.bio;
    if (updates.avatarUrl !== undefined) this.avatarUrl = updates.avatarUrl;
    if (updates.phoneNumber !== undefined) this.phoneNumber = updates.phoneNumber;
    if (updates.dateOfBirth !== undefined) this.dateOfBirth = updates.dateOfBirth;
    if (updates.location !== undefined) this.location = updates.location;
    if (updates.website !== undefined) this.website = updates.website;
    if (updates.socialLinks !== undefined) {
      this._socialLinks = updates.socialLinks || {};
    }
    if (updates.preferences !== undefined) {
      this._preferences = updates.preferences || {};
    }

    this.calculateProfileCompleteness();
  }

  // Social links management
  public addSocialLink(platform: string, url: string): void {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid URL for ${platform}`);
    }
    this._socialLinks = { ...this._socialLinks, [platform]: url };
    this.updateProfileTimestamp();
  }

  public removeSocialLink(platform: string): void {
    if (this._socialLinks && this._socialLinks[platform]) {
      delete this._socialLinks[platform];
      this.updateProfileTimestamp();
    }
  }

  // Preferences management
  public updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): void {
    this._preferences = { ...this._preferences, [key]: value };
    this.updateProfileTimestamp();
  }

  // Linked accounts management
  public addLinkedAccount(account: LinkedAccount): void {
    // Remove existing account for the same provider
    this._linkedAccounts = this._linkedAccounts.filter(
      acc => acc.provider !== account.provider
    );
    this._linkedAccounts.push(account);
    this.updateProfileTimestamp();
  }

  public removeLinkedAccount(provider: string): void {
    this._linkedAccounts = this._linkedAccounts.filter(
      acc => acc.provider !== provider
    );
    this.updateProfileTimestamp();
  }

  public getLinkedAccount(provider: string): LinkedAccount | undefined {
    return this._linkedAccounts.find(acc => acc.provider === provider);
  }

  // Profile completeness calculation
  public calculateProfileCompleteness(): number {
    const fields = [
      'name', 'email', 'bio', 'avatarUrl', 'phoneNumber', 
      'location', 'website', 'dateOfBirth'
    ];
    
    let completedFields = 0;
    
    // Basic fields
    if (this.name) completedFields++;
    if (this.email) completedFields++;
    if (this._bio) completedFields++;
    if (this._avatarUrl) completedFields++;
    if (this._phoneNumber) completedFields++;
    if (this._location) completedFields++;
    if (this._website) completedFields++;
    if (this._dateOfBirth) completedFields++;
    
    // Social links bonus
    if (Object.keys(this._socialLinks || {}).length > 0) {
      completedFields += 0.5;
    }
    
    // Preferences bonus
    if (Object.keys(this._preferences || {}).length > 0) {
      completedFields += 0.5;
    }

    this._profileCompleteness = Math.round((completedFields / fields.length) * 100);
    return this._profileCompleteness;
  }

  // Validation methods
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation (international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  private sanitizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except + at the start
    return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  }

  private sanitizeText(text: string, maxLength: number = 255): string {
    // Basic XSS prevention and length limiting
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove < and > characters
      .trim()
      .substring(0, maxLength);
  }

  private updateProfileTimestamp(): void {
    this._lastProfileUpdate = new Date();
    this._updatedAt = new Date();
  }

  // Enhanced validation including profile fields
  public validate(): { isValid: boolean; errors: string[] } {
    const baseValidation = super.validate();
    const errors = [...baseValidation.errors];

    // Profile field validation
    if (this._bio && this._bio.length > 500) {
      errors.push("Bio must be 500 characters or less");
    }

    if (this._location && this._location.length > 100) {
      errors.push("Location must be 100 characters or less");
    }

    if (this._website && !this.isValidUrl(this._website)) {
      errors.push("Invalid website URL format");
    }

    if (this._phoneNumber && !this.isValidPhoneNumber(this._phoneNumber)) {
      errors.push("Invalid phone number format");
    }

    if (this._dateOfBirth) {
      const now = new Date();
      const age = now.getFullYear() - this._dateOfBirth.getFullYear();
      if (age < 13 || this._dateOfBirth > now) {
        errors.push("Invalid date of birth");
      }
    }

    // Validate social links
    if (this._socialLinks) {
      for (const [platform, url] of Object.entries(this._socialLinks)) {
        if (url && !this.isValidUrl(url)) {
          errors.push(`Invalid URL for ${platform}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Enhanced JSON serialization
  public toJSON(): Record<string, unknown> {
    const baseJson = super.toJSON();
    
    return {
      ...baseJson,
      bio: this._bio,
      avatarUrl: this._avatarUrl,
      phoneNumber: this._phoneNumber,
      dateOfBirth: this._dateOfBirth?.toISOString(),
      location: this._location,
      website: this._website,
      socialLinks: this._socialLinks,
      preferences: this._preferences,
      lastProfileUpdate: this._lastProfileUpdate?.toISOString(),
      profileCompleteness: this._profileCompleteness,
      linkedAccounts: this._linkedAccounts.map(acc => ({
        ...acc,
        linkedAt: acc.linkedAt.toISOString(),
        lastSyncAt: acc.lastSyncAt?.toISOString()
      }))
    };
  }

  // Create UserProfile from JSON
  public static fromJSON(json: any): UserProfile {
    return new UserProfile({
      id: json.id,
      email: json.email,
      name: json.name,
      emailVerified: json.emailVerified,
      image: json.image,
      phone: json.phone,
      twoFactorEnabled: json.twoFactorEnabled,
      isActive: json.isActive,
      role: json.role,
      stripeCustomerId: json.stripeCustomerId,
      preferredCurrency: json.preferredCurrency,
      timezone: json.timezone,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
      lastLoginAt: json.lastLoginAt ? new Date(json.lastLoginAt) : undefined,
      bio: json.bio,
      avatarUrl: json.avatarUrl,
      phoneNumber: json.phoneNumber,
      dateOfBirth: json.dateOfBirth ? new Date(json.dateOfBirth) : undefined,
      location: json.location,
      website: json.website,
      socialLinks: json.socialLinks,
      preferences: json.preferences,
      lastProfileUpdate: json.lastProfileUpdate ? new Date(json.lastProfileUpdate) : undefined,
      profileCompleteness: json.profileCompleteness || 0,
      linkedAccounts: (json.linkedAccounts || []).map((acc: any) => ({
        ...acc,
        linkedAt: new Date(acc.linkedAt),
        lastSyncAt: acc.lastSyncAt ? new Date(acc.lastSyncAt) : undefined
      }))
    });
  }

  // Create UserProfile from Prisma model
  public static fromPrismaModel(data: any): UserProfile {
    return new UserProfile({
      id: data.id,
      email: data.email,
      name: data.name,
      emailVerified: data.emailVerified,
      image: data.image,
      phone: data.phone,
      twoFactorEnabled: data.twoFactorEnabled,
      isActive: data.isActive,
      role: data.role,
      stripeCustomerId: data.stripeCustomerId,
      preferredCurrency: data.preferredCurrency,
      timezone: data.timezone,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastLoginAt: data.lastLoginAt,
      bio: data.bio,
      avatarUrl: data.avatarUrl,
      phoneNumber: data.phoneNumber,
      dateOfBirth: data.dateOfBirth,
      location: data.location,
      website: data.website,
      socialLinks: data.socialLinks,
      preferences: data.preferences,
      lastProfileUpdate: data.lastProfileUpdate,
      profileCompleteness: data.profileCompleteness || 0,
      linkedAccounts: (data.linkedAccounts || []).map((acc: any) => ({
        id: acc.id,
        provider: acc.provider,
        providerId: acc.providerId,
        providerEmail: acc.providerEmail,
        displayName: acc.displayName,
        profileUrl: acc.profileUrl,
        avatarUrl: acc.avatarUrl,
        isActive: acc.isActive,
        linkedAt: acc.linkedAt,
        lastSyncAt: acc.lastSyncAt
      }))
    });
  }

  // Get age from date of birth
  public getAge(): number | null {
    if (!this._dateOfBirth) return null;
    
    const today = new Date();
    let age = today.getFullYear() - this._dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - this._dateOfBirth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this._dateOfBirth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Check if profile is public based on preferences
  public isProfilePublic(): boolean {
    return this._preferences?.privacySettings?.profileVisibility !== 'private';
  }

  // Get profile stats
  public getProfileStats(): {
    completeness: number;
    linkedAccountsCount: number;
    age: number | null;
    lastUpdated: Date | undefined;
  } {
    return {
      completeness: this._profileCompleteness,
      linkedAccountsCount: this._linkedAccounts.length,
      age: this.getAge(),
      lastUpdated: this._lastProfileUpdate
    };
  }
}

// Type exports
export type { UserProfileConstructorParams };