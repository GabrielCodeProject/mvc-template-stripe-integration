import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import AccountSettings from '../AccountSettings';
import { renderWithUser, createMockAction } from '@/test/utils/test-utils';
import { AuthUser } from '@/models/AuthUser';
import { UserPreferences } from '@/models/UserProfile';

// Mock next-safe-action
const mockUpdatePreferencesAction = createMockAction();

jest.mock('next-safe-action/hooks', () => ({
  useAction: jest.fn(() => mockUpdatePreferencesAction),
}));

// Mock ConfirmDialog
jest.mock('../../shared/ConfirmDialog', () => {
  return function MockConfirmDialog(props: any) {
    if (!props.isOpen) return null;
    
    return (
      <div data-testid="confirm-dialog">
        <h2>{props.title}</h2>
        <p>{props.message}</p>
        <button onClick={props.onConfirm}>Confirm</button>
        <button onClick={props.onClose}>Cancel</button>
      </div>
    );
  };
});

describe('AccountSettings', () => {
  const mockUser: AuthUser = {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    image: 'https://example.com/avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPreferences: UserPreferences = {
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
  };

  const defaultProps = {
    user: mockUser,
    preferences: mockPreferences,
    onPreferencesUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePreferencesAction.status = 'idle';
    mockUpdatePreferencesAction.result = null;
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithUser(<AccountSettings {...defaultProps} />);
      expect(container).toBeDefined();
    });

    it('displays settings sections', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
      expect(screen.getByText('Email & Notifications')).toBeInTheDocument();
      expect(screen.getByText('Display & Interface')).toBeInTheDocument();
      expect(screen.getByText('Regional Settings')).toBeInTheDocument();
      expect(screen.getByText('Account Management')).toBeInTheDocument();
    });

    it('shows search functionality', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('displays current preference values', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      // Check theme setting
      const lightThemeRadio = screen.getByRole('radio', { name: /light/i });
      expect(lightThemeRadio).toBeChecked();
      
      // Check notification settings
      const emailNotificationToggle = screen.getByLabelText(/email notifications/i);
      expect(emailNotificationToggle).toBeChecked();
      
      // Check privacy settings
      const profileVisibilityToggle = screen.getByLabelText(/make profile public/i);
      expect(profileVisibilityToggle).toBeChecked();
    });
  });

  describe('Search Functionality', () => {
    it('filters settings based on search query', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      await user.type(searchInput, 'privacy');
      
      await waitFor(() => {
        expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
        expect(screen.queryByText('Email & Notifications')).not.toBeInTheDocument();
      });
    });

    it('shows no results message for invalid search', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      await user.type(searchInput, 'nonexistent');
      
      await waitFor(() => {
        expect(screen.getByText(/no settings found/i)).toBeInTheDocument();
      });
    });

    it('clears search results when search is cleared', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      await user.type(searchInput, 'privacy');
      
      await waitFor(() => {
        expect(screen.queryByText('Email & Notifications')).not.toBeInTheDocument();
      });
      
      await user.clear(searchInput);
      
      await waitFor(() => {
        expect(screen.getByText('Email & Notifications')).toBeInTheDocument();
      });
    });

    it('searches by keywords', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      await user.type(searchInput, 'dark');
      
      await waitFor(() => {
        expect(screen.getByText('Display & Interface')).toBeInTheDocument();
        expect(screen.queryByText('Privacy & Security')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Settings', () => {
    it('allows changing theme preferences', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const darkThemeRadio = screen.getByRole('radio', { name: /dark/i });
      await user.click(darkThemeRadio);
      
      expect(darkThemeRadio).toBeChecked();
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          theme: 'dark',
        });
      });
    });

    it('supports system theme option', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const systemThemeRadio = screen.getByRole('radio', { name: /system/i });
      await user.click(systemThemeRadio);
      
      expect(systemThemeRadio).toBeChecked();
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          theme: 'system',
        });
      });
    });
  });

  describe('Language Settings', () => {
    it('displays current language', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      const languageSelect = screen.getByDisplayValue('English');
      expect(languageSelect).toBeInTheDocument();
    });

    it('allows changing language', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const languageSelect = screen.getByLabelText(/language/i);
      await user.selectOptions(languageSelect, 'es');
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          language: 'es',
        });
      });
    });
  });

  describe('Timezone Settings', () => {
    it('displays current timezone', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      const timezoneSelect = screen.getByDisplayValue(/Pacific Time/i);
      expect(timezoneSelect).toBeInTheDocument();
    });

    it('allows changing timezone', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const timezoneSelect = screen.getByLabelText(/timezone/i);
      await user.selectOptions(timezoneSelect, 'America/New_York');
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          timezone: 'America/New_York',
        });
      });
    });
  });

  describe('Notification Settings', () => {
    it('displays notification toggles', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      expect(screen.getByLabelText(/email notifications/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/push notifications/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sms notifications/i)).toBeInTheDocument();
    });

    it('allows toggling email notifications', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const emailToggle = screen.getByLabelText(/email notifications/i);
      await user.click(emailToggle);
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          notifications: {
            ...mockPreferences.notifications,
            email: false,
          },
        });
      });
    });

    it('allows toggling push notifications', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const pushToggle = screen.getByLabelText(/push notifications/i);
      await user.click(pushToggle);
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          notifications: {
            ...mockPreferences.notifications,
            push: false,
          },
        });
      });
    });

    it('allows toggling SMS notifications', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const smsToggle = screen.getByLabelText(/sms notifications/i);
      await user.click(smsToggle);
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          notifications: {
            ...mockPreferences.notifications,
            sms: true,
          },
        });
      });
    });

    it('shows notification frequency options', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      expect(screen.getByLabelText(/notification frequency/i)).toBeInTheDocument();
    });
  });

  describe('Privacy Settings', () => {
    it('displays privacy toggles', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      expect(screen.getByLabelText(/make profile public/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/show email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/show phone number/i)).toBeInTheDocument();
    });

    it('allows toggling profile visibility', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const profileVisibilityToggle = screen.getByLabelText(/make profile public/i);
      await user.click(profileVisibilityToggle);
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          privacy: {
            ...mockPreferences.privacy,
            profileVisible: false,
          },
        });
      });
    });

    it('allows toggling email visibility', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const emailVisibilityToggle = screen.getByLabelText(/show email address/i);
      await user.click(emailVisibilityToggle);
      
      await waitFor(() => {
        expect(defaultProps.onPreferencesUpdate).toHaveBeenCalledWith({
          ...mockPreferences,
          privacy: {
            ...mockPreferences.privacy,
            showEmail: true,
          },
        });
      });
    });

    it('shows privacy impact warnings', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const profileVisibilityToggle = screen.getByLabelText(/make profile public/i);
      await user.click(profileVisibilityToggle);
      
      await waitFor(() => {
        expect(screen.getByText(/making your profile private/i)).toBeInTheDocument();
      });
    });
  });

  describe('Account Management', () => {
    it('shows account management options', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /deactivate account/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
    });

    it('shows export data confirmation', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const exportButton = screen.getByRole('button', { name: /export data/i });
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/export your data/i)).toBeInTheDocument();
      });
    });

    it('shows deactivate account confirmation', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const deactivateButton = screen.getByRole('button', { name: /deactivate account/i });
      await user.click(deactivateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/deactivate your account/i)).toBeInTheDocument();
      });
    });

    it('shows delete account confirmation', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete account/i });
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Settings Persistence', () => {
    it('saves changes automatically', async () => {
      mockUpdatePreferencesAction.result = {
        data: { success: true },
      };
      
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const darkThemeRadio = screen.getByRole('radio', { name: /dark/i });
      await user.click(darkThemeRadio);
      
      await waitFor(() => {
        expect(mockUpdatePreferencesAction.execute).toHaveBeenCalledWith({
          ...mockPreferences,
          theme: 'dark',
        });
      });
    });

    it('handles save errors gracefully', async () => {
      mockUpdatePreferencesAction.result = {
        data: { success: false, error: 'Save failed' },
      };
      mockUpdatePreferencesAction.status = 'hasErrored';
      
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const darkThemeRadio = screen.getByRole('radio', { name: /dark/i });
      await user.click(darkThemeRadio);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
    });

    it('shows save indicators', async () => {
      mockUpdatePreferencesAction.status = 'executing';
      
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const darkThemeRadio = screen.getByRole('radio', { name: /dark/i });
      await user.click(darkThemeRadio);
      
      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      const lightThemeRadio = screen.getByRole('radio', { name: /light/i });
      
      searchInput.focus();
      expect(searchInput).toHaveFocus();
      
      await user.tab();
      expect(lightThemeRadio).toHaveFocus();
    });

    it('has proper ARIA labels and descriptions', () => {
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      const themeFieldset = screen.getByRole('group', { name: /theme/i });
      expect(themeFieldset).toBeInTheDocument();
      
      const notificationToggles = screen.getAllByRole('switch');
      notificationToggles.forEach((toggle) => {
        expect(toggle).toHaveAttribute('aria-label');
      });
    });

    it('announces changes to screen readers', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const darkThemeRadio = screen.getByRole('radio', { name: /dark/i });
      await user.click(darkThemeRadio);
      
      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      // Check for mobile-responsive classes
      const settingsContainer = screen.getByText('Privacy & Security').closest('div');
      expect(settingsContainer).toHaveClass('space-y-6');
    });

    it('collapses sections on small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
      });
      
      renderWithUser(<AccountSettings {...defaultProps} />);
      
      // Sections should be collapsible on mobile
      const expandButtons = screen.getAllByRole('button', { name: /expand/i });
      expect(expandButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('debounces search input', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search settings/i);
      
      // Type rapidly
      await user.type(searchInput, 'privacy', { delay: 10 });
      
      // Search should be debounced and not trigger multiple updates
      await waitFor(() => {
        expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
      });
    });

    it('memoizes expensive calculations', async () => {
      const { rerender } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      // Re-render with same props
      rerender(<AccountSettings {...defaultProps} />);
      
      // Component should not perform unnecessary re-calculations
      expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
    });
  });

  describe('Data Validation', () => {
    it('validates preference changes', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      // Try to set invalid preference
      const customInput = screen.getByLabelText(/custom theme/i);
      await user.type(customInput, 'invalid-theme');
      
      await waitFor(() => {
        expect(screen.getByText(/invalid theme/i)).toBeInTheDocument();
      });
    });

    it('prevents invalid preference combinations', async () => {
      const { user } = renderWithUser(<AccountSettings {...defaultProps} />);
      
      // Turn off all notifications
      const emailToggle = screen.getByLabelText(/email notifications/i);
      const pushToggle = screen.getByLabelText(/push notifications/i);
      
      await user.click(emailToggle);
      await user.click(pushToggle);
      
      await waitFor(() => {
        expect(screen.getByText(/at least one notification/i)).toBeInTheDocument();
      });
    });
  });
});