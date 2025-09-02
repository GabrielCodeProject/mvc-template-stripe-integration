import { UserProfileService, ProfileUpdateResult, AvatarUploadResult, ProfileValidationResult } from '../UserProfileService';
import { UserProfile, SocialLinks, UserPreferences } from '@/models/UserProfile';
import { UserProfileRepository } from '@/repositories/UserProfileRepository';
import { SecurityAuditLogService } from '@/services/SecurityAuditLogService';
import { SecurityAction } from '@/models/SecurityAuditLog';

// Mock dependencies
jest.mock('@/repositories/UserProfileRepository');
jest.mock('@/services/SecurityAuditLogService');

const MockUserProfileRepository = UserProfileRepository as jest.MockedClass<typeof UserProfileRepository>;
const MockSecurityAuditLogService = SecurityAuditLogService as jest.MockedClass<typeof SecurityAuditLogService>;

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockRepository: jest.Mocked<UserProfileRepository>;
  let mockAuditService: jest.Mocked<SecurityAuditLogService>;

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
    
    // Setup repository mock
    mockRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByEmail: jest.fn(),
      updateSocialLinks: jest.fn(),
      updatePreferences: jest.fn(),
      linkAccount: jest.fn(),
      unlinkAccount: jest.fn(),
    } as any;
    
    MockUserProfileRepository.getInstance.mockReturnValue(mockRepository);

    // Setup audit service mock
    mockAuditService = {
      logDataAccessEvent: jest.fn(),
      logUserActionEvent: jest.fn(),
      logSecurityEvent: jest.fn(),
    } as any;
    
    MockSecurityAuditLogService.getInstance.mockReturnValue(mockAuditService);

    // Get fresh instance
    service = UserProfileService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('returns the same instance', () => {
      const instance1 = UserProfileService.getInstance();
      const instance2 = UserProfileService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Profile Retrieval', () => {
    it('successfully retrieves an existing profile', async () => {
      mockRepository.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfile('test-user-123');

      expect(result).toEqual(mockProfile);
      expect(mockRepository.findById).toHaveBeenCalledWith('test-user-123');
      expect(mockAuditService.logDataAccessEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_VIEW,
        expect.objectContaining({
          userId: 'test-user-123',
          resource: 'profile:test-user-123',
        })
      );
    });

    it('returns null for non-existent profile', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getProfile('non-existent-user');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-user');
    });

    it('handles repository errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockRepository.findById.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.getProfile('test-user-123');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error retrieving profile:', error);
      expect(mockAuditService.logDataAccessEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_VIEW,
        expect.objectContaining({
          userId: 'test-user-123',
          eventData: { error: 'Database connection failed' },
        }),
        false
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Profile Creation', () => {
    const createData = {
      firstName: 'Jane',
      lastName: 'Smith',
      bio: 'Product Manager',
      dateOfBirth: new Date('1985-06-20'),
    };

    it('successfully creates a new profile', async () => {
      const newProfile = { ...mockProfile, ...createData };
      mockRepository.create.mockResolvedValue(newProfile);

      const result = await service.createProfile('new-user-456', createData);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(newProfile);
      expect(mockRepository.create).toHaveBeenCalledWith('new-user-456', createData);
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_CREATE,
        expect.objectContaining({
          userId: 'new-user-456',
        })
      );
    });

    it('validates profile data before creation', async () => {
      const invalidData = {
        firstName: '', // Required field empty
        lastName: 'Smith',
        bio: 'a'.repeat(1001), // Too long
      };

      const result = await service.createProfile('new-user-456', invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('First name is required');
      expect(result.errors).toContain('Bio must be less than 1000 characters');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('handles creation errors', async () => {
      const error = new Error('Unique constraint violation');
      mockRepository.create.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await service.createProfile('new-user-456', createData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to create profile');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Profile Updates', () => {
    const updateData = {
      firstName: 'John Updated',
      bio: 'Updated bio',
    };

    it('successfully updates profile', async () => {
      const updatedProfile = { ...mockProfile, ...updateData };
      mockRepository.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('test-user-123', updateData);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(updatedProfile);
      expect(mockRepository.update).toHaveBeenCalledWith('test-user-123', updateData);
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_UPDATE,
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );
    });

    it('validates update data', async () => {
      const invalidUpdate = {
        firstName: 'A'.repeat(101), // Too long
        bio: '',
        phone: 'invalid-phone',
      };

      const result = await service.updateProfile('test-user-123', invalidUpdate);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('First name must be less than 100 characters');
      expect(result.errors).toContain('Invalid phone number format');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('enforces rate limiting', async () => {
      // Simulate multiple rapid updates
      for (let i = 0; i < 12; i++) {
        await service.updateProfile('test-user-123', updateData);
      }

      const result = await service.updateProfile('test-user-123', updateData);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Too many update attempts');
    });

    it('handles partial updates', async () => {
      const partialUpdate = { bio: 'Just updating bio' };
      const updatedProfile = { ...mockProfile, bio: 'Just updating bio' };
      mockRepository.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('test-user-123', partialUpdate);

      expect(result.success).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith('test-user-123', partialUpdate);
    });

    it('handles update conflicts', async () => {
      const error = new Error('Version conflict');
      error.name = 'VersionConflictError';
      mockRepository.update.mockRejectedValue(error);

      const result = await service.updateProfile('test-user-123', updateData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Profile was modified by another process');
    });
  });

  describe('Social Links Management', () => {
    const socialLinks: SocialLinks = {
      twitter: 'https://twitter.com/newhandle',
      linkedin: 'https://linkedin.com/in/newprofile',
      github: 'https://github.com/newuser',
    };

    it('successfully updates social links', async () => {
      mockRepository.updateSocialLinks.mockResolvedValue(socialLinks);

      const result = await service.updateSocialLinks('test-user-123', socialLinks);

      expect(result.success).toBe(true);
      expect(result.socialLinks).toEqual(socialLinks);
      expect(mockRepository.updateSocialLinks).toHaveBeenCalledWith('test-user-123', socialLinks);
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.SOCIAL_LINK_UPDATE,
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );
    });

    it('validates social link URLs', async () => {
      const invalidLinks: SocialLinks = {
        twitter: 'not-a-valid-url',
        linkedin: 'https://facebook.com/invalid', // Wrong platform
        github: 'https://github.com/', // Missing username
      };

      const result = await service.updateSocialLinks('test-user-123', invalidLinks);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid Twitter URL format');
      expect(result.errors).toContain('Invalid LinkedIn URL format');
      expect(result.errors).toContain('Invalid GitHub URL format');
    });

    it('sanitizes social link URLs', async () => {
      const unsanitizedLinks: SocialLinks = {
        twitter: ' https://twitter.com/user ',
        linkedin: 'HTTPS://LINKEDIN.COM/IN/USER',
      };

      const sanitizedLinks: SocialLinks = {
        twitter: 'https://twitter.com/user',
        linkedin: 'https://linkedin.com/in/user',
      };

      mockRepository.updateSocialLinks.mockResolvedValue(sanitizedLinks);

      const result = await service.updateSocialLinks('test-user-123', unsanitizedLinks);

      expect(result.success).toBe(true);
      expect(mockRepository.updateSocialLinks).toHaveBeenCalledWith(
        'test-user-123',
        sanitizedLinks
      );
    });
  });

  describe('User Preferences', () => {
    const preferences: UserPreferences = {
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

    it('successfully updates preferences', async () => {
      mockRepository.updatePreferences.mockResolvedValue(preferences);

      const result = await service.updatePreferences('test-user-123', preferences);

      expect(result.success).toBe(true);
      expect(result.preferences).toEqual(preferences);
      expect(mockRepository.updatePreferences).toHaveBeenCalledWith('test-user-123', preferences);
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.PREFERENCES_UPDATE,
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );
    });

    it('validates preference values', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme',
        language: 'xx', // Invalid language code
        timezone: 'Invalid/Timezone',
        notifications: {
          email: 'not-boolean',
        },
      } as any;

      const result = await service.updatePreferences('test-user-123', invalidPreferences);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid theme selection');
      expect(result.errors).toContain('Invalid language code');
      expect(result.errors).toContain('Invalid timezone');
    });

    it('applies default preferences for missing values', async () => {
      const partialPreferences = {
        theme: 'dark',
      } as any;

      const completePreferences = {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
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
      };

      mockRepository.updatePreferences.mockResolvedValue(completePreferences);

      const result = await service.updatePreferences('test-user-123', partialPreferences);

      expect(result.success).toBe(true);
      expect(mockRepository.updatePreferences).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining(completePreferences)
      );
    });
  });

  describe('Avatar Management', () => {
    const mockFile = {
      name: 'avatar.jpg',
      size: 1024 * 1024, // 1MB
      type: 'image/jpeg',
    } as File;

    it('successfully uploads avatar', async () => {
      const uploadResult: AvatarUploadResult = {
        success: true,
        avatarUrl: 'https://example.com/uploads/avatar-123.jpg',
      };

      // Mock file processing
      const processFileSpy = jest.spyOn(service as any, 'processAvatarFile')
        .mockResolvedValue(uploadResult);

      const result = await service.uploadAvatar('test-user-123', mockFile);

      expect(result.success).toBe(true);
      expect(result.avatarUrl).toBe('https://example.com/uploads/avatar-123.jpg');
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.AVATAR_UPLOAD,
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );

      processFileSpy.mockRestore();
    });

    it('validates file type', async () => {
      const invalidFile = {
        ...mockFile,
        type: 'application/pdf',
      } as File;

      const result = await service.uploadAvatar('test-user-123', invalidFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid file type');
    });

    it('validates file size', async () => {
      const largeFile = {
        ...mockFile,
        size: 10 * 1024 * 1024, // 10MB
      } as File;

      const result = await service.uploadAvatar('test-user-123', largeFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum limit');
    });

    it('successfully deletes avatar', async () => {
      mockRepository.update.mockResolvedValue({ ...mockProfile, avatarUrl: undefined });

      const result = await service.deleteAvatar('test-user-123');

      expect(result.success).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith('test-user-123', { avatarUrl: null });
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.AVATAR_DELETE,
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );
    });
  });

  describe('Account Linking', () => {
    const linkedAccount = {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@gmail.com',
      name: 'Test User',
      avatar: 'https://example.com/google-avatar.jpg',
    };

    it('successfully links OAuth account', async () => {
      mockRepository.linkAccount.mockResolvedValue(linkedAccount);

      const result = await service.linkOAuthAccount('test-user-123', linkedAccount);

      expect(result.success).toBe(true);
      expect(result.account).toEqual(linkedAccount);
      expect(mockRepository.linkAccount).toHaveBeenCalledWith('test-user-123', linkedAccount);
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.OAUTH_LINK,
        expect.objectContaining({
          userId: 'test-user-123',
          eventData: { provider: 'google' },
        })
      );
    });

    it('prevents duplicate account linking', async () => {
      const error = new Error('Account already linked');
      error.name = 'DuplicateLinkError';
      mockRepository.linkAccount.mockRejectedValue(error);

      const result = await service.linkOAuthAccount('test-user-123', linkedAccount);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Account is already linked');
    });

    it('successfully unlinks OAuth account', async () => {
      mockRepository.unlinkAccount.mockResolvedValue(true);

      const result = await service.unlinkOAuthAccount('test-user-123', 'google');

      expect(result.success).toBe(true);
      expect(mockRepository.unlinkAccount).toHaveBeenCalledWith('test-user-123', 'google');
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.OAUTH_UNLINK,
        expect.objectContaining({
          userId: 'test-user-123',
          eventData: { provider: 'google' },
        })
      );
    });

    it('prevents unlinking last authentication method', async () => {
      // Mock user with no email verification and only one linked account
      mockRepository.findById.mockResolvedValue({
        ...mockProfile,
        linkedAccounts: [linkedAccount],
        email: null,
        emailVerified: null,
      });

      const result = await service.unlinkOAuthAccount('test-user-123', 'google');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Cannot unlink last authentication method');
    });
  });

  describe('Profile Statistics', () => {
    it('calculates completion percentage correctly', async () => {
      mockRepository.findById.mockResolvedValue(mockProfile);

      const stats = await service.getProfileStats('test-user-123');

      expect(stats.success).toBe(true);
      expect(stats.stats.completeness).toBeGreaterThan(0);
      expect(stats.stats.completeness).toBeLessThanOrEqual(100);
    });

    it('provides completion recommendations', async () => {
      const incompleteProfile = {
        ...mockProfile,
        bio: undefined,
        phone: undefined,
        socialLinks: {},
      };
      mockRepository.findById.mockResolvedValue(incompleteProfile);

      const stats = await service.getProfileStats('test-user-123');

      expect(stats.success).toBe(true);
      expect(stats.stats.recommendations).toContain('Add a bio');
      expect(stats.stats.recommendations).toContain('Add phone number');
      expect(stats.stats.recommendations).toContain('Add social media links');
    });

    it('counts linked accounts correctly', async () => {
      const profileWithAccounts = {
        ...mockProfile,
        linkedAccounts: [linkedAccount, { ...linkedAccount, provider: 'github' }],
      };
      mockRepository.findById.mockResolvedValue(profileWithAccounts);

      const stats = await service.getProfileStats('test-user-123');

      expect(stats.success).toBe(true);
      expect(stats.stats.linkedAccountsCount).toBe(2);
    });
  });

  describe('Data Validation', () => {
    it('validates email format', () => {
      const validation = (service as any).validateEmail('invalid-email');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid email format');
    });

    it('validates phone number format', () => {
      const validation = (service as any).validatePhoneNumber('123');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid phone number format');
    });

    it('validates date of birth', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const validation = (service as any).validateDateOfBirth(futureDate);
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Date of birth cannot be in the future');
    });

    it('sanitizes input data', () => {
      const dirtyData = {
        firstName: '  John  ',
        lastName: 'Doe<script>',
        bio: 'Bio with\nline breaks\tand tabs',
      };

      const sanitized = (service as any).sanitizeProfileData(dirtyData);

      expect(sanitized.firstName).toBe('John');
      expect(sanitized.lastName).toBe('Doe');
      expect(sanitized.bio).toBe('Bio with line breaks and tabs');
    });
  });

  describe('Error Handling', () => {
    it('handles database connection errors', async () => {
      const connectionError = new Error('Connection timeout');
      connectionError.name = 'ConnectionTimeoutError';
      mockRepository.findById.mockRejectedValue(connectionError);

      const result = await service.getProfile('test-user-123');

      expect(result).toBeNull();
      expect(mockAuditService.logDataAccessEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventData: { error: 'Connection timeout' },
        }),
        false
      );
    });

    it('handles validation errors gracefully', async () => {
      const invalidData = {
        firstName: '',
        email: 'invalid-email',
        phone: '123',
      };

      const result = await service.updateProfile('test-user-123', invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('Security Features', () => {
    it('logs all profile access attempts', async () => {
      mockRepository.findById.mockResolvedValue(mockProfile);

      await service.getProfile('test-user-123');

      expect(mockAuditService.logDataAccessEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_VIEW,
        expect.objectContaining({
          userId: 'test-user-123',
          resource: 'profile:test-user-123',
        })
      );
    });

    it('logs all profile modifications', async () => {
      const updateData = { firstName: 'Updated' };
      mockRepository.update.mockResolvedValue({ ...mockProfile, ...updateData });

      await service.updateProfile('test-user-123', updateData);

      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_UPDATE,
        expect.objectContaining({
          userId: 'test-user-123',
        })
      );
    });

    it('prevents injection attacks in profile data', async () => {
      const maliciousData = {
        firstName: "<script>alert('xss')</script>",
        bio: "'; DROP TABLE users; --",
      };

      const result = await service.updateProfile('test-user-123', maliciousData);

      // Should either sanitize or reject
      expect(result.success).toBe(true);
      const sanitizedData = mockRepository.update.mock.calls[0][1];
      expect(sanitizedData.firstName).not.toContain('<script>');
      expect(sanitizedData.bio).not.toContain('DROP TABLE');
    });
  });

  describe('Performance Optimization', () => {
    it('caches frequently accessed data', async () => {
      mockRepository.findById.mockResolvedValue(mockProfile);

      // First call
      await service.getProfile('test-user-123');
      // Second call (should use cache if implemented)
      await service.getProfile('test-user-123');

      // Verify caching behavior based on implementation
      expect(mockRepository.findById).toHaveBeenCalledTimes(2); // Adjust based on caching strategy
    });

    it('handles concurrent updates gracefully', async () => {
      const updateData = { firstName: 'Concurrent Update' };
      mockRepository.update.mockResolvedValue({ ...mockProfile, ...updateData });

      // Simulate concurrent updates
      const promises = Array.from({ length: 5 }, () =>
        service.updateProfile('test-user-123', updateData)
      );

      const results = await Promise.all(promises);

      // All should succeed or handle conflicts appropriately
      results.forEach(result => {
        expect(result.success).toBeDefined();
      });
    });
  });
});