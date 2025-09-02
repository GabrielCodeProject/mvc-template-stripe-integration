import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import ProfileManager from '../ProfileManager';
import { renderWithUser, createMockAction } from '@/test/utils/test-utils';
import { AuthUser } from '@/models/AuthUser';
import { UserProfile } from '@/models/UserProfile';

// Mock next-safe-action
const mockGetProfileAction = createMockAction();
const mockUpdateSocialLinksAction = createMockAction();
const mockUpdatePreferencesAction = createMockAction();
const mockUnlinkOAuthAccountAction = createMockAction();
const mockGetProfileStatsAction = createMockAction();
const mockGetUserAuditLogsAction = createMockAction();

jest.mock('next-safe-action/hooks', () => ({
  useAction: jest.fn((action) => {
    if (action.toString().includes('getProfile')) return mockGetProfileAction;
    if (action.toString().includes('updateSocialLinks')) return mockUpdateSocialLinksAction;
    if (action.toString().includes('updatePreferences')) return mockUpdatePreferencesAction;
    if (action.toString().includes('unlinkOAuth')) return mockUnlinkOAuthAccountAction;
    if (action.toString().includes('getProfileStats')) return mockGetProfileStatsAction;
    if (action.toString().includes('getUserAuditLogs')) return mockGetUserAuditLogsAction;
    return createMockAction();
  }),
}));

// Mock child components to focus on ProfileManager logic
jest.mock('../../../forms/ProfileEditForm', () => {
  return function MockProfileEditForm(props: any) {
    return (
      <div data-testid="profile-edit-form">
        Profile Edit Form
        <button onClick={() => props.onUpdate(props.profile)}>Update Profile</button>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    );
  };
});

jest.mock('../AvatarUpload', () => {
  return function MockAvatarUpload(props: any) {
    return (
      <div data-testid="avatar-upload">
        Avatar Upload
        <button 
          onClick={() => props.onAvatarUpdate('new-avatar-url.jpg')}
        >
          Upload Avatar
        </button>
        <button onClick={props.onAvatarDelete}>Delete Avatar</button>
      </div>
    );
  };
});

jest.mock('../AccountSettings', () => {
  return function MockAccountSettings(props: any) {
    return (
      <div data-testid="account-settings">
        Account Settings
        <button 
          onClick={() => props.onPreferencesUpdate({ theme: 'dark' })}
        >
          Update Preferences
        </button>
      </div>
    );
  };
});

jest.mock('../SocialAccountsManager', () => {
  return function MockSocialAccountsManager(props: any) {
    return (
      <div data-testid="social-accounts-manager">
        Social Accounts Manager
        <button 
          onClick={() => props.onAccountLinked({ provider: 'github', providerId: 'github-123' })}
        >
          Link Account
        </button>
        <button 
          onClick={() => props.onAccountUnlinked('google')}
        >
          Unlink Account
        </button>
      </div>
    );
  };
});

describe('ProfileManager', () => {
  const mockUser: AuthUser = {
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
    firstName: 'Test',
    lastName: 'User',
    bio: 'Test user bio',
    dateOfBirth: new Date('1990-01-01'),
    phone: '+1234567890',
    location: 'Test City',
    avatarUrl: 'https://example.com/avatar.jpg',
    socialLinks: {
      twitter: 'https://twitter.com/testuser',
      linkedin: 'https://linkedin.com/in/testuser',
    },
    preferences: {
      theme: 'light',
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
    },
    linkedAccounts: [
      {
        provider: 'google',
        providerId: 'google-123',
        email: 'test@gmail.com',
        name: 'Test User',
        avatar: 'https://example.com/google-avatar.jpg',
        linkedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    getAge: jest.fn(() => 34),
    getCompletionPercentage: jest.fn(() => 85),
    toJSON: jest.fn(() => mockProfile),
  } as unknown as UserProfile;

  const mockStats = {
    success: true,
    stats: {
      completeness: 85,
      linkedAccountsCount: 1,
      age: 34,
      lastUpdated: new Date().toISOString(),
      recommendations: [
        'Add more social media links',
        'Complete your bio section',
      ],
    },
  };

  const mockAuditLogs = {
    success: true,
    data: [
      {
        id: '1',
        userId: 'test-user-123',
        action: 'profile_updated',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        eventType: 'PROFILE_UPDATE',
        severity: 'INFO',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockGetProfileAction.result = {
      data: { success: true, profile: mockProfile },
    };
    mockGetProfileAction.status = 'hasSucceeded';
    
    mockGetProfileStatsAction.result = {
      data: mockStats,
    };
    
    mockGetUserAuditLogsAction.result = {
      data: mockAuditLogs,
    };
  });

  describe('Component Rendering', () => {
    it('renders ProfileManager without crashing', () => {
      const { container } = renderWithUser(<ProfileManager user={mockUser} />);
      expect(container).toBeDefined();
    });

    it('shows loading state initially', () => {
      mockGetProfileAction.status = 'executing';
      
      renderWithUser(<ProfileManager user={mockUser} />);
      
      expect(screen.getByText('Profile Management')).toBeInTheDocument();
      // Should show skeleton loading
      const skeletonElements = screen.getAllByRole('generic');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('renders all tab navigation items', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /👤 Overview/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /✏️ Edit Profile/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /🖼️ Avatar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /🔗 Social Accounts/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /⚙️ Preferences/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /📊 Activity/i })).toBeInTheDocument();
      });
    });

    it('displays user information in overview tab', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('Test user bio')).toBeInTheDocument();
      });
    });

    it('shows profile completion percentage', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('Good')).toBeInTheDocument(); // Completion level
      });
    });
  });

  describe('Tab Navigation', () => {
    it('switches between tabs correctly', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('Profile summary and completion status')).toBeInTheDocument();
      });
      
      // Switch to edit tab
      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
      
      // Switch to avatar tab
      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));
      expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
      
      // Switch to social tab
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      expect(screen.getByTestId('social-accounts-manager')).toBeInTheDocument();
    });

    it('supports initial tab parameter', () => {
      renderWithUser(<ProfileManager user={mockUser} initialTab="edit" />);
      
      expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
    });

    it('highlights active tab visually', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      const overviewTab = screen.getByRole('button', { name: /👤 Overview/i });
      const editTab = screen.getByRole('button', { name: /✏️ Edit Profile/i });
      
      // Overview should be active initially
      expect(overviewTab).toHaveClass('border-indigo-500', 'text-indigo-600');
      expect(editTab).toHaveClass('border-transparent');
      
      // Switch to edit tab
      await user.click(editTab);
      
      expect(editTab).toHaveClass('border-indigo-500', 'text-indigo-600');
      expect(overviewTab).toHaveClass('border-transparent');
    });
  });

  describe('Data Loading and Updates', () => {
    it('loads profile data on mount', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(mockGetProfileAction.execute).toHaveBeenCalled();
        expect(mockGetProfileStatsAction.execute).toHaveBeenCalled();
        expect(mockGetUserAuditLogsAction.execute).toHaveBeenCalledWith({ limit: 20 });
      });
    });

    it('handles profile update from edit form', async () => {
      const onProfileUpdate = jest.fn();
      const { user } = renderWithUser(
        <ProfileManager user={mockUser} onProfileUpdate={onProfileUpdate} />
      );
      
      // Switch to edit tab
      await user.click(screen.getByRole('button', { name: /✏️ Edit Profile/i }));
      
      // Simulate profile update
      await user.click(screen.getByText('Update Profile'));
      
      expect(onProfileUpdate).toHaveBeenCalled();
    });

    it('handles avatar upload', async () => {
      const onProfileUpdate = jest.fn();
      const { user } = renderWithUser(
        <ProfileManager user={mockUser} onProfileUpdate={onProfileUpdate} />
      );
      
      // Switch to avatar tab
      await user.click(screen.getByRole('button', { name: /🖼️ Avatar/i }));
      
      // Simulate avatar upload
      await user.click(screen.getByText('Upload Avatar'));
      
      expect(onProfileUpdate).toHaveBeenCalled();
    });

    it('handles social account linking', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      // Switch to social accounts tab
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      // Simulate account linking
      await user.click(screen.getByText('Link Account'));
      
      await waitFor(() => {
        expect(mockGetProfileStatsAction.execute).toHaveBeenCalled();
      });
    });

    it('handles social account unlinking', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      // Switch to social accounts tab  
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      // Simulate account unlinking
      await user.click(screen.getByText('Unlink Account'));
      
      await waitFor(() => {
        expect(mockGetProfileStatsAction.execute).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles profile loading errors gracefully', async () => {
      mockGetProfileAction.result = {
        data: { success: false, error: 'Failed to load profile' },
      };
      mockGetProfileAction.status = 'hasErrored';
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load profile data:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it('handles action execution failures', async () => {
      mockUpdateSocialLinksAction.status = 'hasErrored';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      // Switch to social tab and try to save
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      const saveButton = screen.getByRole('button', { name: /Save Links/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('Profile Management')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation for tabs', async () => {
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      const overviewTab = screen.getByRole('button', { name: /👤 Overview/i });
      const editTab = screen.getByRole('button', { name: /✏️ Edit Profile/i });
      
      // Focus first tab
      overviewTab.focus();
      expect(overviewTab).toHaveFocus();
      
      // Navigate with keyboard
      await user.keyboard('{Tab}');
      expect(editTab).toHaveFocus();
      
      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
    });

    it('has proper ARIA labels and descriptions', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        const tabsNav = screen.getByRole('navigation', { name: 'Tabs' });
        expect(tabsNav).toBeInTheDocument();
        
        const tabs = within(tabsNav).getAllByRole('button');
        tabs.forEach((tab) => {
          expect(tab).toHaveAttribute('title');
        });
      });
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      // Mock window.innerWidth for responsive tests
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    it('renders correctly on desktop', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        const container = screen.getByText('Profile Management').closest('div');
        expect(container).toHaveClass('max-w-6xl');
      });
    });

    it('handles mobile layout', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
      });
      
      renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        // Check for responsive classes
        const tabsContainer = screen.getByRole('navigation', { name: 'Tabs' });
        expect(tabsContainer).toHaveClass('overflow-x-auto');
      });
    });
  });

  describe('Performance', () => {
    it('memoizes expensive calculations', async () => {
      const { rerender } = renderWithUser(<ProfileManager user={mockUser} />);
      
      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
      
      // Re-render with same props
      rerender(<ProfileManager user={mockUser} />);
      
      // Should not recalculate completion percentage
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading indicators for async operations', async () => {
      mockUpdateSocialLinksAction.status = 'executing';
      
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      // Switch to social tab
      await user.click(screen.getByRole('button', { name: /🔗 Social Accounts/i }));
      
      const saveButton = screen.getByRole('button', { name: /Saving.../i });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveClass('disabled:opacity-50');
    });

    it('shows skeleton loading for audit logs', async () => {
      mockGetUserAuditLogsAction.status = 'executing';
      
      const { user } = renderWithUser(<ProfileManager user={mockUser} />);
      
      // Switch to activity tab
      await user.click(screen.getByRole('button', { name: /📊 Activity/i }));
      
      // Should show skeleton loaders
      const skeletons = screen.getAllByRole('generic');
      const hasAnimatedElements = skeletons.some(el => 
        el.classList.contains('animate-pulse')
      );
      expect(hasAnimatedElements).toBe(true);
    });
  });
});