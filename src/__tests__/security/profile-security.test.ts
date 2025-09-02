import { UserProfileService } from '@/services/UserProfileService';
import { SecurityAuditLogService } from '@/services/SecurityAuditLogService';
import { UserProfileRepository } from '@/repositories/UserProfileRepository';
import { SecurityAction } from '@/models/SecurityAuditLog';
import { UserProfile, SocialLinks, UserPreferences } from '@/models/UserProfile';

// Security testing for profile management system
describe('Profile Security Tests', () => {
  let service: UserProfileService;
  let mockRepository: jest.Mocked<UserProfileRepository>;
  let mockAuditService: jest.Mocked<SecurityAuditLogService>;

  beforeEach(() => {
    // Mock repository
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

    // Mock audit service
    mockAuditService = {
      logDataAccessEvent: jest.fn(),
      logUserActionEvent: jest.fn(),
      logSecurityEvent: jest.fn(),
    } as any;

    // Mock dependencies
    jest.clearAllMocks();
    (UserProfileRepository.getInstance as jest.Mock).mockReturnValue(mockRepository);
    (SecurityAuditLogService.getInstance as jest.Mock).mockReturnValue(mockAuditService);

    service = UserProfileService.getInstance();
  });

  describe('Input Validation and Sanitization', () => {
    describe('XSS Prevention', () => {
      it('sanitizes script tags in profile data', async () => {
        const maliciousData = {
          firstName: '<script>alert("xss")</script>John',
          lastName: 'Doe<img src="x" onerror="alert(1)">',
          bio: 'Bio with <iframe src="javascript:alert(1)"></iframe> malicious content',
          location: 'City<object data="data:text/html,<script>alert(1)</script>"></object>',
        };

        mockRepository.update.mockResolvedValue({} as UserProfile);

        await service.updateProfile('user-123', maliciousData);

        const sanitizedCall = mockRepository.update.mock.calls[0][1];
        expect(sanitizedCall.firstName).not.toContain('<script>');
        expect(sanitizedCall.lastName).not.toContain('<img');
        expect(sanitizedCall.bio).not.toContain('<iframe');
        expect(sanitizedCall.location).not.toContain('<object');
      });

      it('prevents JavaScript execution in social links', async () => {
        const maliciousSocialLinks: SocialLinks = {
          twitter: 'javascript:alert("xss")',
          linkedin: 'https://linkedin.com/in/user"><script>alert(1)</script>',
          github: 'data:text/html,<script>alert(1)</script>',
          website: 'https://example.com/onclick="alert(1)"',
        };

        const result = await service.updateSocialLinks('user-123', maliciousSocialLinks);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid Twitter URL format');
        expect(result.errors).toContain('Invalid LinkedIn URL format');
        expect(result.errors).toContain('Invalid GitHub URL format');
      });

      it('escapes HTML entities in text fields', async () => {
        const htmlData = {
          firstName: '&lt;John&gt;',
          bio: 'Bio with &amp; special &quot;characters&quot;',
        };

        mockRepository.update.mockResolvedValue({} as UserProfile);

        await service.updateProfile('user-123', htmlData);

        const updateCall = mockRepository.update.mock.calls[0][1];
        expect(updateCall.firstName).toBe('<John>');
        expect(updateCall.bio).toBe('Bio with & special "characters"');
      });
    });

    describe('SQL Injection Prevention', () => {
      it('prevents SQL injection in profile queries', async () => {
        const sqlInjectionAttempt = {
          firstName: "'; DROP TABLE users; --",
          bio: "1' OR '1'='1",
          location: "City'; DELETE FROM profiles WHERE '1'='1",
        };

        mockRepository.update.mockResolvedValue({} as UserProfile);

        await service.updateProfile('user-123', sqlInjectionAttempt);

        // Repository should receive sanitized data
        const updateCall = mockRepository.update.mock.calls[0][1];
        expect(updateCall.firstName).not.toContain('DROP TABLE');
        expect(updateCall.bio).not.toContain("OR '1'='1");
        expect(updateCall.location).not.toContain('DELETE FROM');
      });

      it('validates user ID format to prevent injection', async () => {
        const maliciousUserId = "1'; DROP TABLE profiles; --";

        const result = await service.getProfile(maliciousUserId);

        // Should not pass malicious ID to repository
        expect(mockRepository.findById).not.toHaveBeenCalledWith(maliciousUserId);
      });
    });

    describe('Path Traversal Prevention', () => {
      it('prevents directory traversal in avatar uploads', async () => {
        const maliciousFile = {
          name: '../../../etc/passwd',
          size: 1024,
          type: 'image/jpeg',
        } as File;

        const result = await service.uploadAvatar('user-123', maliciousFile);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid filename');
      });

      it('validates file extensions strictly', async () => {
        const maliciousFile = {
          name: 'image.jpg.php',
          size: 1024,
          type: 'image/jpeg',
        } as File;

        const result = await service.uploadAvatar('user-123', maliciousFile);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid file extension');
      });
    });

    describe('LDAP Injection Prevention', () => {
      it('sanitizes search queries for profile lookups', async () => {
        const maliciousEmail = 'user@example.com)(&(password=*))';

        await service.getProfileByEmail?.(maliciousEmail);

        // Should sanitize LDAP special characters
        expect(mockRepository.findByEmail).not.toHaveBeenCalledWith(
          expect.stringContaining('&(password=*)')
        );
      });
    });
  });

  describe('Authorization and Access Control', () => {
    describe('Profile Access Control', () => {
      it('prevents unauthorized profile access', async () => {
        const result = await service.getProfile('unauthorized-user-456');

        // Should log unauthorized access attempt
        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
          SecurityAction.UNAUTHORIZED_ACCESS,
          expect.objectContaining({
            userId: 'unauthorized-user-456',
            severity: 'HIGH',
          })
        );
      });

      it('validates ownership before profile updates', async () => {
        const updateData = { firstName: 'Malicious Update' };

        // Mock authorization failure
        mockRepository.update.mockRejectedValue(new Error('Unauthorized'));

        const result = await service.updateProfile('other-user-789', updateData);

        expect(result.success).toBe(false);
        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
          SecurityAction.UNAUTHORIZED_MODIFICATION,
          expect.objectContaining({
            userId: 'other-user-789',
          })
        );
      });

      it('prevents privilege escalation through profile updates', async () => {
        const privilegeEscalationAttempt = {
          role: 'admin',
          permissions: ['all'],
          isAdmin: true,
        };

        mockRepository.update.mockResolvedValue({} as UserProfile);

        await service.updateProfile('user-123', privilegeEscalationAttempt);

        // Should not pass privileged fields to repository
        const updateCall = mockRepository.update.mock.calls[0][1];
        expect(updateCall).not.toHaveProperty('role');
        expect(updateCall).not.toHaveProperty('permissions');
        expect(updateCall).not.toHaveProperty('isAdmin');
      });
    });

    describe('OAuth Security', () => {
      it('validates OAuth state parameter', async () => {
        const maliciousOAuthData = {
          provider: 'google',
          code: 'auth-code',
          state: 'malicious-state',
        };

        const result = await service.linkOAuthAccount('user-123', maliciousOAuthData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid OAuth state');
      });

      it('prevents OAuth provider impersonation', async () => {
        const impersonationAttempt = {
          provider: 'fake-provider',
          providerId: 'fake-id',
          email: 'admin@company.com',
          name: 'System Administrator',
        };

        const result = await service.linkOAuthAccount('user-123', impersonationAttempt);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid OAuth provider');
      });

      it('validates OAuth token integrity', async () => {
        const tamperedTokenData = {
          provider: 'google',
          access_token: 'tampered.token.signature',
          refresh_token: 'malicious-refresh',
        };

        const result = await service.linkOAuthAccount('user-123', tamperedTokenData);

        expect(result.success).toBe(false);
        expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
          SecurityAction.OAUTH_TOKEN_VALIDATION_FAILED,
          expect.objectContaining({
            userId: 'user-123',
            provider: 'google',
          })
        );
      });
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('enforces rate limits on profile updates', async () => {
      const updateData = { firstName: 'Rapid Update' };
      
      // Simulate rapid updates beyond rate limit
      for (let i = 0; i < 15; i++) {
        await service.updateProfile('user-123', updateData);
      }

      const result = await service.updateProfile('user-123', updateData);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Too many update attempts');
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        SecurityAction.RATE_LIMIT_EXCEEDED,
        expect.objectContaining({
          userId: 'user-123',
          action: 'profile_update',
        })
      );
    });

    it('limits file upload frequency', async () => {
      const testFile = {
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
      } as File;

      // Simulate rapid uploads
      for (let i = 0; i < 10; i++) {
        await service.uploadAvatar('user-123', testFile);
      }

      const result = await service.uploadAvatar('user-123', testFile);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Upload rate limit exceeded');
    });

    it('prevents large payload DoS attacks', async () => {
      const largePayload = {
        bio: 'x'.repeat(1000000), // 1MB string
        firstName: 'a'.repeat(50000),
      };

      const result = await service.updateProfile('user-123', largePayload);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Payload too large');
    });
  });

  describe('Data Privacy and GDPR Compliance', () => {
    it('implements right to be forgotten', async () => {
      await service.deleteProfile('user-123', { reason: 'user_request' });

      expect(mockRepository.delete).toHaveBeenCalledWith('user-123');
      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_DELETE,
        expect.objectContaining({
          userId: 'user-123',
          reason: 'gdpr_deletion',
        })
      );
    });

    it('anonymizes data for analytics while preserving privacy', async () => {
      const analyticsData = await service.getAnonymizedProfileStats('user-123');

      expect(analyticsData).not.toContain('user-123');
      expect(analyticsData).not.toHaveProperty('email');
      expect(analyticsData).not.toHaveProperty('name');
    });

    it('enforces data retention policies', async () => {
      const oldDate = new Date('2020-01-01');
      await service.cleanupExpiredData(oldDate);

      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.DATA_RETENTION_CLEANUP,
        expect.objectContaining({
          cleanupDate: oldDate,
        })
      );
    });

    it('provides data portability', async () => {
      const exportedData = await service.exportUserData('user-123');

      expect(exportedData).toHaveProperty('profile');
      expect(exportedData).toHaveProperty('preferences');
      expect(exportedData).toHaveProperty('socialLinks');
      expect(exportedData.format).toBe('json');
      expect(exportedData.version).toBe('1.0');
    });
  });

  describe('Cryptographic Security', () => {
    it('hashes sensitive data before storage', async () => {
      const sensitiveData = {
        phone: '+1234567890',
        socialSecurityNumber: '123-45-6789',
      };

      mockRepository.update.mockResolvedValue({} as UserProfile);

      await service.updateProfile('user-123', sensitiveData);

      const updateCall = mockRepository.update.mock.calls[0][1];
      expect(updateCall.phone).not.toBe('+1234567890');
      expect(updateCall.phone).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('uses secure random generators for tokens', async () => {
      const resetToken = await service.generatePasswordResetToken('user-123');

      expect(resetToken).toHaveLength(64); // 32 bytes * 2 (hex)
      expect(resetToken).toMatch(/^[0-9a-f]+$/); // hexadecimal
      
      // Should be cryptographically secure
      const entropy = calculateEntropy(resetToken);
      expect(entropy).toBeGreaterThan(4); // High entropy
    });

    it('validates data integrity with checksums', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        checksum: 'invalid-checksum',
      };

      const result = await service.updateProfile('user-123', profileData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Data integrity check failed');
    });
  });

  describe('Session Security', () => {
    it('invalidates sessions after profile security changes', async () => {
      const securityUpdate = {
        email: 'newemail@example.com',
        password: 'newpassword123',
      };

      await service.updateProfile('user-123', securityUpdate);

      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        SecurityAction.SESSION_INVALIDATION,
        expect.objectContaining({
          userId: 'user-123',
          reason: 'security_change',
        })
      );
    });

    it('detects suspicious session patterns', async () => {
      // Simulate profile access from multiple IPs
      const suspiciousPattern = [
        { ip: '192.168.1.1', location: 'USA' },
        { ip: '10.0.0.1', location: 'Russia' },
        { ip: '172.16.0.1', location: 'China' },
      ];

      for (const access of suspiciousPattern) {
        await service.getProfile('user-123', { clientIP: access.ip });
      }

      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        SecurityAction.SUSPICIOUS_ACTIVITY,
        expect.objectContaining({
          userId: 'user-123',
          pattern: 'multiple_locations',
        })
      );
    });
  });

  describe('Audit Logging and Monitoring', () => {
    it('logs all profile access attempts', async () => {
      await service.getProfile('user-123');

      expect(mockAuditService.logDataAccessEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_VIEW,
        expect.objectContaining({
          userId: 'user-123',
          resource: 'profile:user-123',
        })
      );
    });

    it('logs all profile modifications with details', async () => {
      const updateData = { firstName: 'Updated Name' };
      mockRepository.update.mockResolvedValue({} as UserProfile);

      await service.updateProfile('user-123', updateData);

      expect(mockAuditService.logUserActionEvent).toHaveBeenCalledWith(
        SecurityAction.PROFILE_UPDATE,
        expect.objectContaining({
          userId: 'user-123',
          eventData: expect.objectContaining({
            fieldsUpdated: ['firstName'],
            oldValues: expect.any(Object),
            newValues: expect.any(Object),
          }),
        })
      );
    });

    it('logs failed authorization attempts', async () => {
      mockRepository.update.mockRejectedValue(new Error('Unauthorized'));

      await service.updateProfile('unauthorized-user', { firstName: 'Test' });

      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        SecurityAction.UNAUTHORIZED_MODIFICATION,
        expect.objectContaining({
          userId: 'unauthorized-user',
          severity: 'HIGH',
        })
      );
    });

    it('monitors for anomalous behavior patterns', async () => {
      // Simulate unusual activity patterns
      const unusualPatterns = [
        { action: 'bulk_updates', threshold: 50 },
        { action: 'off_hours_access', time: '03:00' },
        { action: 'unusual_fields', fields: ['admin_notes'] },
      ];

      for (const pattern of unusualPatterns) {
        await service.detectAnomalousActivity('user-123', pattern);
      }

      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        SecurityAction.ANOMALY_DETECTED,
        expect.objectContaining({
          userId: 'user-123',
          anomalyType: expect.any(String),
        })
      );
    });
  });

  describe('File Upload Security', () => {
    it('validates file content against MIME type', async () => {
      const maliciousFile = {
        name: 'malicious.jpg',
        size: 1024,
        type: 'image/jpeg',
        // Simulate file with script content but image MIME type
        content: '<script>alert("xss")</script>',
      } as File;

      const result = await service.uploadAvatar('user-123', maliciousFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File content does not match MIME type');
    });

    it('scans uploaded files for malware', async () => {
      const suspiciousFile = {
        name: 'suspicious.jpg',
        size: 1024,
        type: 'image/jpeg',
        // Simulate file with malware signature
        signature: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      } as File;

      const result = await service.uploadAvatar('user-123', suspiciousFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File failed security scan');
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        SecurityAction.MALWARE_DETECTED,
        expect.objectContaining({
          userId: 'user-123',
          filename: 'suspicious.jpg',
        })
      );
    });

    it('strips metadata from uploaded images', async () => {
      const imageWithMetadata = {
        name: 'photo.jpg',
        size: 2048,
        type: 'image/jpeg',
        exifData: {
          location: 'Secret Location',
          camera: 'Spy Camera',
        },
      } as File;

      mockRepository.update.mockResolvedValue({} as UserProfile);

      const result = await service.uploadAvatar('user-123', imageWithMetadata);

      expect(result.success).toBe(true);
      // Should strip EXIF data for privacy
      expect(result.avatarUrl).toBeDefined();
    });
  });

  describe('Error Handling Security', () => {
    it('prevents information disclosure through error messages', async () => {
      mockRepository.findById.mockRejectedValue(new Error('Database connection to secret_server failed'));

      const result = await service.getProfile('user-123');

      expect(result).toBeNull();
      // Error should not reveal internal details
      expect(mockAuditService.logDataAccessEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventData: expect.not.objectContaining({
            error: expect.stringContaining('secret_server'),
          }),
        }),
        false
      );
    });

    it('handles timing attacks prevention', async () => {
      const startTime = Date.now();
      await service.getProfile('non-existent-user');
      const nonExistentTime = Date.now() - startTime;

      const existingStartTime = Date.now();
      mockRepository.findById.mockResolvedValue({} as UserProfile);
      await service.getProfile('existing-user');
      const existingTime = Date.now() - existingStartTime;

      // Response times should be similar to prevent user enumeration
      const timeDifference = Math.abs(existingTime - nonExistentTime);
      expect(timeDifference).toBeLessThan(100); // Within 100ms
    });
  });

  // Helper function for entropy calculation
  function calculateEntropy(str: string): number {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count as number / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }
});