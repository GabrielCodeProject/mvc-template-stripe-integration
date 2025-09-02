import {
  getProfileAction,
  updateProfileAction,
  updateSocialLinksAction,
  updatePreferencesAction,
  linkOAuthAccountAction,
  unlinkOAuthAccountAction,
  getProfileStatsAction,
} from '../profile.actions';
import { UserProfileService } from '@/services/UserProfileService';
import { AuthService } from '@/services/AuthService';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { UserProfile, SocialLinks, UserPreferences } from '@/models/UserProfile';

// Mock dependencies
jest.mock('@/services/UserProfileService');
jest.mock('@/services/AuthService');
jest.mock('next/cache');
jest.mock('next/headers');

const MockUserProfileService = UserProfileService as jest.MockedClass<typeof UserProfileService>;
const MockAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const mockRevalidatePath = revalidatePath as jest.Mock;
const mockCookies = cookies as jest.Mock;
const mockHeaders = headers as jest.Mock;

describe('Profile Actions', () => {
  let mockProfileService: jest.Mocked<UserProfileService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockCookieStore: any;
  let mockHeadersList: any;

  const mockUser = {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    image: 'https://example.com/avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: UserProfile = {
    userId: 'test-user-123',
    firstName: 'John',
    lastName: 'Doe',
    bio: 'Software developer',
    dateOfBirth: new Date('1990-01-15'),
    phone: '+1234567890',
    location: 'San Francisco, CA',
    avatarUrl: 'https://example.com/avatar.jpg',
    socialLinks: {
      twitter: 'https://twitter.com/johndoe',
      linkedin: 'https://linkedin.com/in/johndoe',
    },
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        profileVisible: true,
        showEmail: false,
        showPhone: false,
      },
    },
    linkedAccounts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    getAge: jest.fn(() => 33),
    getCompletionPercentage: jest.fn(() => 85),
    toJSON: jest.fn(() => mockProfile),
  } as unknown as UserProfile;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup profile service mock
    mockProfileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      updateSocialLinks: jest.fn(),
      updatePreferences: jest.fn(),
      linkOAuthAccount: jest.fn(),
      unlinkOAuthAccount: jest.fn(),
      getProfileStats: jest.fn(),
    } as any;
    MockUserProfileService.getInstance.mockReturnValue(mockProfileService);

    // Setup auth service mock
    mockAuthService = {
      getUserBySession: jest.fn(),
    } as any;
    MockAuthService.getInstance.mockReturnValue(mockAuthService);

    // Setup cookies mock
    mockCookieStore = {
      get: jest.fn(),
      delete: jest.fn(),
    };
    mockCookies.mockResolvedValue(mockCookieStore);

    // Setup headers mock
    mockHeadersList = {
      get: jest.fn(),
    };
    mockHeaders.mockResolvedValue(mockHeadersList);

    // Default successful auth setup
    mockCookieStore.get.mockReturnValue({ value: 'valid-session-token' });
    mockAuthService.getUserBySession.mockResolvedValue(mockUser);
    mockHeadersList.get.mockImplementation((header: string) => {
      switch (header) {
        case 'user-agent':
          return 'Mozilla/5.0 Test Browser';
        case 'x-forwarded-for':
          return '192.168.1.1';
        default:
          return null;
      }
    });
  });

  describe('Authentication Middleware', () => {
    it('throws error when no session token exists', async () => {
      mockCookieStore.get.mockReturnValue(null);

      const result = await getProfileAction();

      expect(result.serverError).toBe('Authentication required');
      expect(mockAuthService.getUserBySession).not.toHaveBeenCalled();
    });

    it('throws error when session token is invalid', async () => {
      mockAuthService.getUserBySession.mockResolvedValue(null);

      const result = await getProfileAction();

      expect(result.serverError).toBe('Invalid session');
      expect(mockCookieStore.delete).toHaveBeenCalledWith('session');
    });

    it('successfully authenticates with valid session', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const result = await getProfileAction();

      expect(result.data?.success).toBe(true);
      expect(result.data?.profile).toEqual(mockProfile);
      expect(mockAuthService.getUserBySession).toHaveBeenCalledWith('valid-session-token');
    });
  });

  describe('getProfileAction', () => {
    it('successfully retrieves user profile', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const result = await getProfileAction();

      expect(result.data?.success).toBe(true);
      expect(result.data?.profile).toEqual(mockProfile);
      expect(mockProfileService.getProfile).toHaveBeenCalledWith('test-user-123');
    });

    it('handles profile not found', async () => {
      mockProfileService.getProfile.mockResolvedValue(null);

      const result = await getProfileAction();

      expect(result.data?.success).toBe(false);
      expect(result.data?.error).toBe('Profile not found');
    });

    it('handles service errors', async () => {
      mockProfileService.getProfile.mockRejectedValue(new Error('Database error'));

      const result = await getProfileAction();

      expect(result.serverError).toBe('Database error');
    });
  });

  describe('updateProfileAction', () => {
    const validUpdateData = {
      firstName: 'John Updated',
      lastName: 'Doe Updated',
      bio: 'Updated bio',
      phone: '+1987654321',
      location: 'New York, NY',
    };

    it('successfully updates profile with valid data', async () => {
      const updatedProfile = { ...mockProfile, ...validUpdateData };
      mockProfileService.updateProfile.mockResolvedValue({
        success: true,
        profile: updatedProfile,
      });

      const result = await updateProfileAction(validUpdateData);

      expect(result.data?.success).toBe(true);
      expect(result.data?.profile).toEqual(updatedProfile);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        'test-user-123',
        validUpdateData
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('validates required fields', async () => {
      const invalidData = {
        firstName: '', // Empty required field
        lastName: 'Doe',
        bio: 'a'.repeat(1001), // Too long
      };

      const result = await updateProfileAction(invalidData);

      expect(result.validationErrors).toBeDefined();
      expect(mockProfileService.updateProfile).not.toHaveBeenCalled();
    });

    it('validates phone number format', async () => {
      const invalidPhoneData = {
        ...validUpdateData,
        phone: '123', // Invalid format
      };

      const result = await updateProfileAction(invalidPhoneData);

      expect(result.validationErrors?.phone).toBeDefined();
    });

    it('sanitizes input data', async () => {
      const unsanitizedData = {
        firstName: '  John  ',
        lastName: 'Doe<script>alert("xss")</script>',
        bio: 'Bio with\nspecial\tchars',
      };

      mockProfileService.updateProfile.mockResolvedValue({
        success: true,
        profile: mockProfile,
      });

      const result = await updateProfileAction(unsanitizedData);

      expect(result.data?.success).toBe(true);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe', // Script tags removed
        })
      );
    });

    it('handles update service errors', async () => {
      mockProfileService.updateProfile.mockResolvedValue({
        success: false,
        errors: ['Update failed'],
      });

      const result = await updateProfileAction(validUpdateData);

      expect(result.data?.success).toBe(false);
      expect(result.data?.errors).toEqual(['Update failed']);
    });

    it('handles rate limiting', async () => {
      mockProfileService.updateProfile.mockRejectedValue(
        new Error('Too many update attempts')
      );

      const result = await updateProfileAction(validUpdateData);

      expect(result.serverError).toBe('Rate limit exceeded. Please wait before trying again.');
    });
  });

  describe('updateSocialLinksAction', () => {
    const validSocialLinks: SocialLinks = {
      twitter: 'https://twitter.com/johndoe',
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
    };

    it('successfully updates social links', async () => {
      mockProfileService.updateSocialLinks.mockResolvedValue({
        success: true,
        socialLinks: validSocialLinks,
      });

      const result = await updateSocialLinksAction(validSocialLinks);

      expect(result.data?.success).toBe(true);
      expect(result.data?.socialLinks).toEqual(validSocialLinks);
      expect(mockProfileService.updateSocialLinks).toHaveBeenCalledWith(
        'test-user-123',
        validSocialLinks
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('validates URL formats', async () => {
      const invalidLinks = {
        twitter: 'not-a-url',
        linkedin: 'https://facebook.com/invalid', // Wrong platform
      };

      const result = await updateSocialLinksAction(invalidLinks);

      expect(result.validationErrors).toBeDefined();
      expect(mockProfileService.updateSocialLinks).not.toHaveBeenCalled();
    });

    it('allows empty strings for optional links', async () => {
      const linksWithEmpty = {
        twitter: '',
        linkedin: 'https://linkedin.com/in/johndoe',
        github: '',
      };

      mockProfileService.updateSocialLinks.mockResolvedValue({
        success: true,
        socialLinks: { linkedin: 'https://linkedin.com/in/johndoe' },
      });

      const result = await updateSocialLinksAction(linksWithEmpty);

      expect(result.data?.success).toBe(true);
    });

    it('validates platform-specific URL patterns', async () => {
      const incorrectPlatformUrls = {
        twitter: 'https://github.com/johndoe', // GitHub URL for Twitter field
        github: 'https://twitter.com/johndoe', // Twitter URL for GitHub field
      };

      mockProfileService.updateSocialLinks.mockResolvedValue({
        success: false,
        errors: ['Invalid Twitter URL format', 'Invalid GitHub URL format'],
      });

      const result = await updateSocialLinksAction(incorrectPlatformUrls);

      // Should pass validation but service should handle platform validation
      expect(result.data?.errors).toContain('Invalid Twitter URL format');
    });
  });

  describe('updatePreferencesAction', () => {
    const validPreferences: UserPreferences = {
      theme: 'dark',
      language: 'es',
      timezone: 'Europe/Madrid',
      notifications: {
        email: false,
        push: true,
        sms: true,
      },
      privacy: {
        profileVisible: false,
        showEmail: true,
        showPhone: false,
      },
    };

    it('successfully updates user preferences', async () => {
      mockProfileService.updatePreferences.mockResolvedValue({
        success: true,
        preferences: validPreferences,
      });

      const result = await updatePreferencesAction(validPreferences);

      expect(result.data?.success).toBe(true);
      expect(result.data?.preferences).toEqual(validPreferences);
      expect(mockProfileService.updatePreferences).toHaveBeenCalledWith(
        'test-user-123',
        validPreferences
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('validates theme enum values', async () => {
      const invalidTheme = {
        theme: 'invalid-theme',
      } as any;

      const result = await updatePreferencesAction(invalidTheme);

      expect(result.validationErrors?.theme).toBeDefined();
      expect(mockProfileService.updatePreferences).not.toHaveBeenCalled();
    });

    it('validates language code format', async () => {
      const invalidLanguage = {
        language: 'invalid-very-long-language-code',
      };

      const result = await updatePreferencesAction(invalidLanguage);

      expect(result.validationErrors?.language).toBeDefined();
    });

    it('handles partial preference updates', async () => {
      const partialPreferences = {
        theme: 'dark',
        language: 'fr',
      } as any;

      mockProfileService.updatePreferences.mockResolvedValue({
        success: true,
        preferences: { ...validPreferences, ...partialPreferences },
      });

      const result = await updatePreferencesAction(partialPreferences);

      expect(result.data?.success).toBe(true);
      expect(mockProfileService.updatePreferences).toHaveBeenCalledWith(
        'test-user-123',
        partialPreferences
      );
    });

    it('validates nested notification preferences', async () => {
      const invalidNotifications = {
        emailNotifications: {
          marketing: 'not-boolean', // Should be boolean
        },
      } as any;

      const result = await updatePreferencesAction(invalidNotifications);

      expect(result.validationErrors?.emailNotifications?.marketing).toBeDefined();
    });

    it('validates privacy settings enums', async () => {
      const invalidPrivacy = {
        privacySettings: {
          profileVisibility: 'invalid-visibility',
        },
      } as any;

      const result = await updatePreferencesAction(invalidPrivacy);

      expect(result.validationErrors?.privacySettings?.profileVisibility).toBeDefined();
    });
  });

  describe('linkOAuthAccountAction', () => {
    const oauthData = {
      provider: 'google',
      code: 'oauth-authorization-code',
    };

    it('successfully links OAuth account', async () => {
      const linkedAccount = {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@gmail.com',
        name: 'Test User',
        avatar: 'https://example.com/google-avatar.jpg',
        linkedAt: new Date(),
      };

      mockProfileService.linkOAuthAccount.mockResolvedValue({
        success: true,
        account: linkedAccount,
      });

      const result = await linkOAuthAccountAction(oauthData);

      expect(result.data?.success).toBe(true);
      expect(result.data?.account).toEqual(linkedAccount);
      expect(mockProfileService.linkOAuthAccount).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          provider: 'google',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('validates OAuth provider', async () => {
      const invalidProvider = {
        provider: 'invalid-provider',
        code: 'test-code',
      };

      const result = await linkOAuthAccountAction(invalidProvider);

      expect(result.validationErrors?.provider).toBeDefined();
      expect(mockProfileService.linkOAuthAccount).not.toHaveBeenCalled();
    });

    it('handles OAuth exchange errors', async () => {
      mockProfileService.linkOAuthAccount.mockResolvedValue({
        success: false,
        errors: ['OAuth authorization failed'],
      });

      const result = await linkOAuthAccountAction(oauthData);

      expect(result.data?.success).toBe(false);
      expect(result.data?.errors).toContain('OAuth authorization failed');
    });

    it('handles duplicate account linking', async () => {
      mockProfileService.linkOAuthAccount.mockRejectedValue(
        new Error('Account already exists')
      );

      const result = await linkOAuthAccountAction(oauthData);

      expect(result.serverError).toBe('This information is already in use by another user.');
    });
  });

  describe('unlinkOAuthAccountAction', () => {
    const unlinkData = {
      provider: 'google',
    };

    it('successfully unlinks OAuth account', async () => {
      mockProfileService.unlinkOAuthAccount.mockResolvedValue({
        success: true,
      });

      const result = await unlinkOAuthAccountAction(unlinkData);

      expect(result.data?.success).toBe(true);
      expect(mockProfileService.unlinkOAuthAccount).toHaveBeenCalledWith(
        'test-user-123',
        'google'
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('validates provider parameter', async () => {
      const invalidProvider = {
        provider: '',
      };

      const result = await unlinkOAuthAccountAction(invalidProvider);

      expect(result.validationErrors?.provider).toBeDefined();
      expect(mockProfileService.unlinkOAuthAccount).not.toHaveBeenCalled();
    });

    it('handles unlinking errors', async () => {
      mockProfileService.unlinkOAuthAccount.mockResolvedValue({
        success: false,
        errors: ['Cannot unlink last authentication method'],
      });

      const result = await unlinkOAuthAccountAction(unlinkData);

      expect(result.data?.success).toBe(false);
      expect(result.data?.errors).toContain('Cannot unlink last authentication method');
    });

    it('handles service errors during unlinking', async () => {
      mockProfileService.unlinkOAuthAccount.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await unlinkOAuthAccountAction(unlinkData);

      expect(result.serverError).toBe('Database connection failed');
    });
  });

  describe('getProfileStatsAction', () => {
    it('successfully retrieves profile statistics', async () => {
      const mockStats = {
        completeness: 85,
        linkedAccountsCount: 2,
        age: 33,
        lastUpdated: new Date().toISOString(),
        recommendations: [
          'Add more social media links',
          'Complete your bio section',
        ],
      };

      mockProfileService.getProfileStats.mockResolvedValue({
        success: true,
        stats: mockStats,
      });

      const result = await getProfileStatsAction();

      expect(result.data?.success).toBe(true);
      expect(result.data?.stats).toEqual(mockStats);
      expect(mockProfileService.getProfileStats).toHaveBeenCalledWith('test-user-123');
    });

    it('handles stats calculation errors', async () => {
      mockProfileService.getProfileStats.mockResolvedValue({
        success: false,
        errors: ['Profile not found'],
      });

      const result = await getProfileStatsAction();

      expect(result.data?.success).toBe(false);
      expect(result.data?.errors).toContain('Profile not found');
    });

    it('handles service errors', async () => {
      mockProfileService.getProfileStats.mockRejectedValue(
        new Error('Stats calculation failed')
      );

      const result = await getProfileStatsAction();

      expect(result.serverError).toBe('Stats calculation failed');
    });
  });

  describe('Error Handling', () => {
    it('handles rate limiting errors with custom message', async () => {
      mockProfileService.updateProfile.mockRejectedValue(
        new Error('Too many requests')
      );

      const result = await updateProfileAction({ firstName: 'Test' });

      expect(result.serverError).toBe('Rate limit exceeded. Please wait before trying again.');
    });

    it('handles invalid URL errors with custom message', async () => {
      mockProfileService.updateSocialLinks.mockRejectedValue(
        new Error('Invalid URL format')
      );

      const result = await updateSocialLinksAction({ twitter: 'https://twitter.com/test' });

      expect(result.serverError).toBe('Please provide valid URLs for links and websites.');
    });

    it('handles duplicate data errors with custom message', async () => {
      mockProfileService.linkOAuthAccount.mockRejectedValue(
        new Error('Account already exists')
      );

      const result = await linkOAuthAccountAction({ provider: 'google', code: 'test' });

      expect(result.serverError).toBe('This information is already in use by another user.');
    });

    it('logs errors for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockProfileService.getProfile.mockRejectedValue(
        new Error('Unexpected error')
      );

      await getProfileAction();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Profile action error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Client Information Capture', () => {
    it('captures client IP and User-Agent', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      await getProfileAction();

      expect(mockHeaders).toHaveBeenCalled();
      expect(mockHeadersList.get).toHaveBeenCalledWith('user-agent');
      expect(mockHeadersList.get).toHaveBeenCalledWith('x-forwarded-for');
    });

    it('handles missing headers gracefully', async () => {
      mockHeadersList.get.mockReturnValue(null);
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const result = await getProfileAction();

      expect(result.data?.success).toBe(true);
      // Should not fail even with missing headers
    });

    it('extracts IP from x-forwarded-for header', async () => {
      mockHeadersList.get.mockImplementation((header: string) => {
        if (header === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
        return null;
      });

      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const result = await getProfileAction();

      expect(result.data?.success).toBe(true);
      // IP should be extracted from the first part of the forwarded header
    });
  });

  describe('Cache Revalidation', () => {
    it('revalidates profile page after successful updates', async () => {
      mockProfileService.updateProfile.mockResolvedValue({
        success: true,
        profile: mockProfile,
      });

      await updateProfileAction({ firstName: 'Updated' });

      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('revalidates after social links update', async () => {
      mockProfileService.updateSocialLinks.mockResolvedValue({
        success: true,
        socialLinks: { twitter: 'https://twitter.com/test' },
      });

      await updateSocialLinksAction({ twitter: 'https://twitter.com/test' });

      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('revalidates after OAuth account linking', async () => {
      mockProfileService.linkOAuthAccount.mockResolvedValue({
        success: true,
        account: {
          provider: 'google',
          providerId: 'google-123',
          email: 'test@gmail.com',
          name: 'Test User',
          linkedAt: new Date(),
        },
      });

      await linkOAuthAccountAction({ provider: 'google', code: 'test-code' });

      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('does not revalidate on failed operations', async () => {
      mockProfileService.updateProfile.mockResolvedValue({
        success: false,
        errors: ['Update failed'],
      });

      await updateProfileAction({ firstName: 'Test' });

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('Input Sanitization', () => {
    it('sanitizes string inputs to prevent XSS', async () => {
      const maliciousInput = {
        firstName: '<script>alert("xss")</script>John',
        bio: 'Bio with <img src="x" onerror="alert(1)"> malicious content',
      };

      mockProfileService.updateProfile.mockResolvedValue({
        success: true,
        profile: mockProfile,
      });

      const result = await updateProfileAction(maliciousInput);

      expect(result.data?.success).toBe(true);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          firstName: expect.not.stringContaining('<script>'),
          bio: expect.not.stringContaining('<img'),
        })
      );
    });

    it('trims whitespace from inputs', async () => {
      const inputWithWhitespace = {
        firstName: '  John  ',
        lastName: '  Doe  ',
      };

      mockProfileService.updateProfile.mockResolvedValue({
        success: true,
        profile: mockProfile,
      });

      await updateProfileAction(inputWithWhitespace);

      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        })
      );
    });
  });
});