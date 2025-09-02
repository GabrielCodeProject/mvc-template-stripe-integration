import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithUser, createMockFile, createDragEvent } from '@/test/utils/test-utils';
import ProfileManager from '@/components/auth/profile/ProfileManager';
import { AuthUser } from '@/models/AuthUser';
import { UserProfile } from '@/models/UserProfile';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

// Integration tests for complete profile management workflows
describe('Profile Management Integration Tests', () => {
  const mockUser: AuthUser = {
    id: 'integration-user-123',
    name: 'Integration Test User',
    email: 'integration@example.com',
    image: 'https://example.com/integration-avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: UserProfile = {
    userId: 'integration-user-123',
    firstName: 'Integration',
    lastName: 'User',
    bio: 'Integration test user for profile management workflows',
    dateOfBirth: new Date('1985-03-15'),
    phone: '+1555123456',
    location: 'Test City, TC',
    avatarUrl: 'https://example.com/integration-avatar.jpg',
    socialLinks: {
      twitter: 'https://twitter.com/integrationuser',
      linkedin: 'https://linkedin.com/in/integrationuser',
    },
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'America/New_York',
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
    linkedAccounts: [
      {
        provider: 'google',
        providerId: 'google-integration-123',
        email: 'integration@gmail.com',
        name: 'Integration User',
        avatar: 'https://example.com/google-integration-avatar.jpg',
        linkedAt: new Date('2023-01-01'),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    getAge: jest.fn(() => 38),
    getCompletionPercentage: jest.fn(() => 90),
    toJSON: jest.fn(() => mockProfile),
  } as unknown as UserProfile;

  beforeEach(() => {
    // Reset MSW handlers to default
    server.resetHandlers();
    
    // Setup successful profile responses
    server.use(
      http.post('/api/profile/get', () => {
        return HttpResponse.json({
          success: true,
          profile: mockProfile,
        });
      }),
      
      http.post('/api/profile/stats', () => {
        return HttpResponse.json({
          success: true,
          stats: {
            completeness: 90,
            linkedAccountsCount: 1,
            age: 38,
            lastUpdated: new Date().toISOString(),
            recommendations: [
              'Add more social media links',
              'Enable SMS notifications',
            ],
          },
        });
      }),
      
      http.post('/api/security/audit-logs', () => {
        return HttpResponse.json({
          success: true,
          data: [
            {
              id: 'integration-log-1',
              userId: 'integration-user-123',
              action: 'profile_updated',
              success: true,
              ipAddress: '192.168.1.100',
              userAgent: 'Integration Test Browser',
              eventType: 'PROFILE_UPDATE',
              severity: 'INFO',
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
        });
      })
    );
  });

  describe('Complete Profile Setup Workflow', () => {
    it('allows user to complete their profile from scratch', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByText('Integration Test User')).toBeInTheDocument();
      });

      // 1. Edit basic profile information
      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
      });

      // Update profile via form
      await user.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(screen.getByText('👤 Overview')).toBeInTheDocument();
      });

      // 2. Upload new avatar
      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
      });

      // Simulate avatar upload
      await user.click(screen.getByText('Upload Avatar'));

      // 3. Connect social accounts
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('social-accounts-manager')).toBeInTheDocument();
      });

      // Link a new account
      await user.click(screen.getByText('Link Account'));

      // 4. Update preferences
      await user.click(screen.getByRole('button', { name: /⚙️ Preferences/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('account-settings')).toBeInTheDocument();
      });

      // Update preferences
      await user.click(screen.getByText('Update Preferences'));

      // 5. View activity log
      await user.click(screen.getByRole('button', { name: /📊 Activity/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Profile Activity')).toBeInTheDocument();
        expect(screen.getByText('Profile Updated')).toBeInTheDocument();
      });
    });

    it('maintains state across tab switches', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Wait for profile to load
      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument(); // Completion percentage
      });

      // Switch to social accounts and back to overview
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      await user.click(screen.getByRole('button', { name: /👤 Overview/i }));

      // State should be maintained
      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('Integration Test User')).toBeInTheDocument();
      });
    });
  });

  describe('Avatar Upload Workflow', () => {
    it('completes full avatar upload and cropping workflow', async () => {
      server.use(
        http.post('/api/uploads/avatar', () => {
          return HttpResponse.json({
            success: true,
            url: 'https://example.com/uploads/new-integration-avatar.jpg',
            filename: 'integration-avatar.jpg',
            size: 1024,
            type: 'image/jpeg',
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Navigate to avatar tab
      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
      });

      // Upload a file
      const file = createMockFile('new-avatar.jpg', 2048, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);

      // Should enter cropping mode
      await waitFor(() => {
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });

      // Apply crop and upload
      await user.click(screen.getByRole('button', { name: /apply crop/i }));

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/avatar updated successfully/i)).toBeInTheDocument();
      });
    });

    it('handles drag and drop avatar upload', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Navigate to avatar tab
      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
      });

      // Simulate drag and drop
      const dropZone = screen.getByText(/drag and drop an image/i).closest('div');
      const file = createMockFile('dropped-avatar.jpg', 1024, 'image/jpeg');
      
      const dragEvent = createDragEvent('drop', [file]);
      dropZone?.dispatchEvent(dragEvent);

      // Should enter cropping mode
      await waitFor(() => {
        expect(screen.getByText(/crop your image/i)).toBeInTheDocument();
      });
    });

    it('handles avatar upload errors gracefully', async () => {
      server.use(
        http.post('/api/uploads/avatar', () => {
          return HttpResponse.json(
            { success: false, error: 'Upload failed' },
            { status: 500 }
          );
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));
      
      const file = createMockFile('error-avatar.jpg', 1024, 'image/jpeg');
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);
      await user.click(screen.getByRole('button', { name: /apply crop/i }));

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Social Account Management Workflow', () => {
    it('completes OAuth account linking workflow', async () => {
      server.use(
        http.post('/api/oauth/link', () => {
          return HttpResponse.json({
            success: true,
            account: {
              provider: 'github',
              providerId: 'github-integration-456',
              email: 'integration@github.com',
              name: 'Integration User',
              avatar: 'https://example.com/github-integration-avatar.jpg',
              linkedAt: new Date(),
            },
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Navigate to social accounts
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('social-accounts-manager')).toBeInTheDocument();
      });

      // Simulate successful OAuth flow
      await user.click(screen.getByText('Link Account'));

      await waitFor(() => {
        expect(screen.getByText(/github account connected/i)).toBeInTheDocument();
      });
    });

    it('handles account unlinking workflow', async () => {
      server.use(
        http.post('/api/oauth/unlink', () => {
          return HttpResponse.json({
            success: true,
            provider: 'google',
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      // Unlink existing account
      await user.click(screen.getByText('Unlink Account'));

      // Confirm in dialog
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(screen.getByText(/google account disconnected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Preferences Management Workflow', () => {
    it('updates multiple preference categories', async () => {
      server.use(
        http.post('/api/profile/preferences', async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            success: true,
            preferences: body,
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Navigate to preferences
      await user.click(screen.getByRole('button', { name: /⚙️ Preferences/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('account-settings')).toBeInTheDocument();
      });

      // Update theme preference
      await user.click(screen.getByText('Update Preferences'));

      await waitFor(() => {
        expect(screen.getByText(/preferences updated/i)).toBeInTheDocument();
      });
    });

    it('validates preference combinations', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /⚙️ Preferences/i }));
      
      // Try to disable all notifications (should show warning)
      await user.click(screen.getByText('Update Preferences'));

      await waitFor(() => {
        // Should show validation warnings if applicable
        expect(screen.getByTestId('account-settings')).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Workflows', () => {
    it('recovers from network errors during profile updates', async () => {
      // Start with network error
      server.use(
        http.post('/api/profile/update', () => {
          return HttpResponse.error();
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      await user.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Fix network and retry
      server.use(
        http.post('/api/profile/update', () => {
          return HttpResponse.json({
            success: true,
            profile: mockProfile,
          });
        })
      );

      await user.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('👤 Overview')).toBeInTheDocument();
      });
    });

    it('handles session expiration during workflow', async () => {
      server.use(
        http.post('/api/profile/update', () => {
          return HttpResponse.json(
            { success: false, error: 'Session expired' },
            { status: 401 }
          );
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      await user.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Consistency Workflows', () => {
    it('maintains data consistency across concurrent updates', async () => {
      let updateCount = 0;
      server.use(
        http.post('/api/profile/update', async ({ request }) => {
          updateCount++;
          const body = await request.json();
          
          // Simulate version conflict on concurrent updates
          if (updateCount > 1) {
            return HttpResponse.json(
              { success: false, error: 'Version conflict' },
              { status: 409 }
            );
          }
          
          return HttpResponse.json({
            success: true,
            profile: { ...mockProfile, ...body },
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Simulate rapid updates
      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      
      // First update
      await user.click(screen.getByText('Update Profile'));
      
      // Immediate second update (should handle conflict)
      await user.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(screen.getByText(/version conflict/i)).toBeInTheDocument();
      });
    });

    it('handles optimistic updates correctly', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Navigate to social links
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      // Add social link (should update optimistically)
      await user.click(screen.getByText('Link Account'));

      // UI should update immediately, then confirm with server
      await waitFor(() => {
        expect(screen.getByTestId('social-accounts-manager')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('supports complete keyboard navigation workflow', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Navigate tabs using keyboard
      const overviewTab = screen.getByRole('button', { name: /👤 Overview/i });
      overviewTab.focus();

      await user.keyboard('{Tab}');
      await user.keyboard('{Enter}');

      // Should navigate to next tab
      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
      });
    });

    it('provides proper screen reader announcements', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));

      // Should have status region for screen reader updates
      await waitFor(() => {
        const statusRegions = screen.getAllByRole('status');
        expect(statusRegions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Mobile Responsive Workflows', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });
    });

    it('adapts workflow for mobile interface', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Tab navigation should work on mobile
      await waitFor(() => {
        const tabsNav = screen.getByRole('navigation', { name: 'Tabs' });
        expect(tabsNav).toHaveClass('overflow-x-auto');
      });

      // Touch interactions should work
      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Integration', () => {
    it('handles large datasets efficiently', async () => {
      const largeAuditLog = Array.from({ length: 100 }, (_, i) => ({
        id: `log-${i}`,
        userId: 'integration-user-123',
        action: `test_action_${i}`,
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        eventType: 'TEST_EVENT',
        severity: 'INFO',
        createdAt: new Date().toISOString(),
      }));

      server.use(
        http.post('/api/security/audit-logs', () => {
          return HttpResponse.json({
            success: true,
            data: largeAuditLog,
            total: 100,
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      await user.click(screen.getByRole('button', { name: /📊 Activity/i }));

      // Should load and display large dataset efficiently
      await waitFor(() => {
        expect(screen.getByText('Profile Activity')).toBeInTheDocument();
        // Should show some events but possibly paginated
        const eventElements = screen.getAllByText(/Test Action/i);
        expect(eventElements.length).toBeGreaterThan(0);
      });
    });

    it('implements proper loading states during async operations', async () => {
      // Add delay to profile loading
      server.use(
        http.post('/api/profile/get', async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return HttpResponse.json({
            success: true,
            profile: mockProfile,
          });
        })
      );

      renderWithUser(<ProfileManager user={mockUser} />);

      // Should show loading state initially
      expect(screen.getByText('Profile Management')).toBeInTheDocument();
      
      // Should eventually load profile
      await waitFor(() => {
        expect(screen.getByText('Integration Test User')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('End-to-End User Scenarios', () => {
    it('supports new user onboarding flow', async () => {
      const incompleteProfile = {
        ...mockProfile,
        firstName: '',
        lastName: '',
        bio: '',
        avatarUrl: undefined,
        socialLinks: {},
      };

      server.use(
        http.post('/api/profile/get', () => {
          return HttpResponse.json({
            success: true,
            profile: incompleteProfile,
          });
        }),
        
        http.post('/api/profile/stats', () => {
          return HttpResponse.json({
            success: true,
            stats: {
              completeness: 20,
              linkedAccountsCount: 0,
              recommendations: [
                'Add your name',
                'Upload a profile picture',
                'Write a bio',
                'Connect social accounts',
              ],
            },
          });
        })
      );

      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Should show low completion and recommendations
      await waitFor(() => {
        expect(screen.getByText('20%')).toBeInTheDocument();
        expect(screen.getByText('Poor')).toBeInTheDocument();
        expect(screen.getByText('Add your name')).toBeInTheDocument();
      });

      // User follows recommendations
      await user.click(screen.getByText('Edit Profile'));
      await user.click(screen.getByText('Update Avatar'));
    });

    it('supports experienced user profile maintenance', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);

      // Experienced user with high completion should see maintenance options
      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
      });

      // Should have quick access to common maintenance tasks
      expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update avatar/i })).toBeInTheDocument();
    });
  });
});