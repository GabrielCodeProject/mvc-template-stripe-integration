import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import ProfileManager from '@/components/auth/profile/ProfileManager';
import ProfileEditForm from '@/components/auth/forms/ProfileEditForm';
import AvatarUpload from '@/components/auth/profile/AvatarUpload';
import AccountSettings from '@/components/auth/profile/AccountSettings';
import SocialAccountsManager from '@/components/auth/profile/SocialAccountsManager';
import { renderWithUser } from '@/test/utils/test-utils';
import { AuthUser } from '@/models/AuthUser';
import { UserProfile, UserPreferences } from '@/models/UserProfile';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock components for isolated testing
jest.mock('next-safe-action/hooks', () => ({
  useAction: () => ({
    execute: jest.fn(),
    status: 'idle',
    result: null,
    isExecuting: false,
    hasSucceeded: false,
    hasErrored: false,
    reset: jest.fn(),
  }),
}));

describe('Profile Management Accessibility Tests', () => {
  const mockUser: AuthUser = {
    id: 'a11y-user-123',
    name: 'Accessibility Test User',
    email: 'a11y@example.com',
    image: 'https://example.com/a11y-avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: UserProfile = {
    userId: 'a11y-user-123',
    firstName: 'Accessibility',
    lastName: 'User',
    bio: 'Testing accessibility compliance in profile management',
    dateOfBirth: new Date('1990-01-01'),
    phone: '+1234567890',
    location: 'Accessibility City, AC',
    avatarUrl: 'https://example.com/a11y-avatar.jpg',
    socialLinks: {
      twitter: 'https://twitter.com/a11yuser',
      linkedin: 'https://linkedin.com/in/a11yuser',
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
    linkedAccounts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    getAge: jest.fn(() => 34),
    getCompletionPercentage: jest.fn(() => 85),
    toJSON: jest.fn(() => mockProfile),
  } as unknown as UserProfile;

  describe('WCAG 2.1 AA Compliance', () => {
    describe('ProfileManager Component', () => {
      it('has no accessibility violations', async () => {
        const { container } = renderWithUser(
          <ProfileManager user={mockUser} />
        );

        await waitFor(() => {
          expect(screen.getByText('Profile Management')).toBeInTheDocument();
        });

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it('provides proper heading hierarchy', async () => {
        renderWithUser(<ProfileManager user={mockUser} />);

        await waitFor(() => {
          const h1 = screen.getByRole('heading', { level: 1 });
          expect(h1).toHaveTextContent('Profile Management');

          const h2s = screen.getAllByRole('heading', { level: 2 });
          expect(h2s.length).toBeGreaterThan(0);
          
          // Should not skip heading levels
          const h4s = screen.queryAllByRole('heading', { level: 4 });
          const h3s = screen.queryAllByRole('heading', { level: 3 });
          if (h4s.length > 0) {
            expect(h3s.length).toBeGreaterThan(0);
          }
        });
      });

      it('has proper landmark regions', async () => {
        renderWithUser(<ProfileManager user={mockUser} />);

        await waitFor(() => {
          expect(screen.getByRole('navigation')).toBeInTheDocument();
          expect(screen.getByRole('main')).toBeInTheDocument();
        });
      });

      it('supports keyboard navigation between tabs', async () => {
        const user = userEvent.setup();
        renderWithUser(<ProfileManager user={mockUser} />);

        await waitFor(() => {
          const tabList = screen.getByRole('tablist');
          expect(tabList).toBeInTheDocument();
          
          const tabs = screen.getAllByRole('tab');
          expect(tabs.length).toBeGreaterThan(0);
          
          // First tab should be focusable
          tabs[0].focus();
          expect(tabs[0]).toHaveFocus();
        });

        // Arrow key navigation
        const tabs = screen.getAllByRole('tab');
        await user.keyboard('{ArrowRight}');
        expect(tabs[1]).toHaveFocus();

        await user.keyboard('{ArrowLeft}');
        expect(tabs[0]).toHaveFocus();

        // Home/End navigation
        await user.keyboard('{End}');
        expect(tabs[tabs.length - 1]).toHaveFocus();

        await user.keyboard('{Home}');
        expect(tabs[0]).toHaveFocus();
      });

      it('manages focus correctly when switching tabs', async () => {
        const user = userEvent.setup();
        renderWithUser(<ProfileManager user={mockUser} />);

        await waitFor(() => {
          const editTab = screen.getByRole('tab', { name: /edit profile/i });
          expect(editTab).toBeInTheDocument();
        });

        const editTab = screen.getByRole('tab', { name: /edit profile/i });
        await user.click(editTab);

        await waitFor(() => {
          expect(editTab).toHaveAttribute('aria-selected', 'true');
          
          // Focus should move to the tab panel content
          const tabPanel = screen.getByRole('tabpanel');
          expect(tabPanel).toBeInTheDocument();
        });
      });

      it('has proper ARIA labels and descriptions', async () => {
        renderWithUser(<ProfileManager user={mockUser} />);

        await waitFor(() => {
          const tabs = screen.getAllByRole('tab');
          tabs.forEach(tab => {
            expect(tab).toHaveAttribute('aria-controls');
            expect(tab).toHaveAttribute('aria-selected');
          });

          const tabPanels = screen.getAllByRole('tabpanel');
          tabPanels.forEach(panel => {
            expect(panel).toHaveAttribute('aria-labelledby');
          });
        });
      });
    });

    describe('ProfileEditForm Component', () => {
      it('has no accessibility violations', async () => {
        const { container } = render(
          <ProfileEditForm
            user={mockUser}
            profile={mockProfile}
            onUpdate={jest.fn()}
            onCancel={jest.fn()}
          />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it('has properly labeled form fields', () => {
        render(
          <ProfileEditForm
            user={mockUser}
            profile={mockProfile}
            onUpdate={jest.fn()}
            onCancel={jest.fn()}
          />
        );

        // All form inputs should have associated labels
        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          expect(input).toHaveAccessibleName();
        });

        // Select elements should have labels
        const selects = screen.getAllByRole('combobox');
        selects.forEach(select => {
          expect(select).toHaveAccessibleName();
        });
      });

      it('provides field descriptions and help text', () => {
        render(
          <ProfileEditForm
            user={mockUser}
            profile={mockProfile}
            onUpdate={jest.fn()}
            onCancel={jest.fn()}
          />
        );

        const phoneInput = screen.getByLabelText(/phone/i);
        expect(phoneInput).toHaveAttribute('aria-describedby');
        
        const bioInput = screen.getByLabelText(/bio/i);
        expect(bioInput).toHaveAttribute('aria-describedby');
      });

      it('announces validation errors to screen readers', async () => {
        const user = userEvent.setup();
        render(
          <ProfileEditForm
            user={mockUser}
            profile={mockProfile}
            onUpdate={jest.fn()}
            onCancel={jest.fn()}
          />
        );

        const firstNameInput = screen.getByLabelText(/first name/i);
        await user.clear(firstNameInput);
        await user.tab(); // Trigger validation

        await waitFor(() => {
          expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
          expect(firstNameInput).toHaveAttribute('aria-describedby');
          
          const errorMessage = screen.getByRole('alert');
          expect(errorMessage).toBeInTheDocument();
        });
      });

      it('groups related form fields appropriately', () => {
        render(
          <ProfileEditForm
            user={mockUser}
            profile={mockProfile}
            onUpdate={jest.fn()}
            onCancel={jest.fn()}
          />
        );

        const personalInfoGroup = screen.getByRole('group', { name: /personal information/i });
        expect(personalInfoGroup).toBeInTheDocument();

        const socialLinksGroup = screen.getByRole('group', { name: /social media links/i });
        expect(socialLinksGroup).toBeInTheDocument();
      });
    });

    describe('AvatarUpload Component', () => {
      it('has no accessibility violations', async () => {
        const { container } = render(
          <AvatarUpload
            user={mockUser}
            currentAvatar="https://example.com/avatar.jpg"
            onAvatarUpdate={jest.fn()}
            onAvatarDelete={jest.fn()}
          />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it('provides accessible file upload interface', () => {
        render(
          <AvatarUpload
            user={mockUser}
            currentAvatar="https://example.com/avatar.jpg"
            onAvatarUpdate={jest.fn()}
            onAvatarDelete={jest.fn()}
          />
        );

        const fileInput = screen.getByLabelText(/upload avatar/i);
        expect(fileInput).toHaveAttribute('accept');
        expect(fileInput).toHaveAccessibleDescription();
      });

      it('announces upload progress to screen readers', async () => {
        render(
          <AvatarUpload
            user={mockUser}
            currentAvatar="https://example.com/avatar.jpg"
            onAvatarUpdate={jest.fn()}
            onAvatarDelete={jest.fn()}
          />
        );

        // Should have status region for announcements
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toBeInTheDocument();
      });

      it('provides proper image alternative text', () => {
        render(
          <AvatarUpload
            user={mockUser}
            currentAvatar="https://example.com/avatar.jpg"
            onAvatarUpdate={jest.fn()}
            onAvatarDelete={jest.fn()}
          />
        );

        const avatarImage = screen.getByRole('img');
        expect(avatarImage).toHaveAttribute('alt');
        expect(avatarImage.getAttribute('alt')).not.toBe('');
      });

      it('supports keyboard interaction for crop controls', async () => {
        const user = userEvent.setup();
        render(
          <AvatarUpload
            user={mockUser}
            onAvatarUpdate={jest.fn()}
            onAvatarDelete={jest.fn()}
          />
        );

        // All interactive elements should be focusable
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).not.toHaveAttribute('tabindex', '-1');
        });
      });
    });

    describe('AccountSettings Component', () => {
      const mockPreferences: UserPreferences = {
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
      };

      it('has no accessibility violations', async () => {
        const { container } = render(
          <AccountSettings
            user={mockUser}
            preferences={mockPreferences}
            onPreferencesUpdate={jest.fn()}
          />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it('uses proper form controls for settings', () => {
        render(
          <AccountSettings
            user={mockUser}
            preferences={mockPreferences}
            onPreferencesUpdate={jest.fn()}
          />
        );

        // Toggle switches should use proper role
        const switches = screen.getAllByRole('switch');
        switches.forEach(toggle => {
          expect(toggle).toHaveAttribute('aria-checked');
          expect(toggle).toHaveAccessibleName();
        });

        // Radio buttons should be grouped
        const radioGroups = screen.getAllByRole('radiogroup');
        radioGroups.forEach(group => {
          expect(group).toHaveAccessibleName();
        });
      });

      it('provides clear setting descriptions', () => {
        render(
          <AccountSettings
            user={mockUser}
            preferences={mockPreferences}
            onPreferencesUpdate={jest.fn()}
          />
        );

        const switches = screen.getAllByRole('switch');
        switches.forEach(toggle => {
          expect(toggle).toHaveAttribute('aria-describedby');
        });
      });

      it('announces setting changes to screen readers', async () => {
        const user = userEvent.setup();
        render(
          <AccountSettings
            user={mockUser}
            preferences={mockPreferences}
            onPreferencesUpdate={jest.fn()}
          />
        );

        const emailToggle = screen.getByRole('switch', { name: /email notifications/i });
        await user.click(emailToggle);

        await waitFor(() => {
          const statusRegion = screen.getByRole('status');
          expect(statusRegion).toBeInTheDocument();
        });
      });

      it('groups related settings with fieldsets', () => {
        render(
          <AccountSettings
            user={mockUser}
            preferences={mockPreferences}
            onPreferencesUpdate={jest.fn()}
          />
        );

        const notificationGroup = screen.getByRole('group', { name: /notifications/i });
        expect(notificationGroup).toBeInTheDocument();

        const privacyGroup = screen.getByRole('group', { name: /privacy/i });
        expect(privacyGroup).toBeInTheDocument();
      });
    });

    describe('SocialAccountsManager Component', () => {
      it('has no accessibility violations', async () => {
        const { container } = render(
          <SocialAccountsManager
            user={mockUser}
            linkedAccounts={[]}
            onAccountLinked={jest.fn()}
            onAccountUnlinked={jest.fn()}
          />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it('provides clear button labels for account actions', () => {
        render(
          <SocialAccountsManager
            user={mockUser}
            linkedAccounts={[]}
            onAccountLinked={jest.fn()}
            onAccountUnlinked={jest.fn()}
          />
        );

        const connectButtons = screen.getAllByRole('button', { name: /connect/i });
        connectButtons.forEach(button => {
          expect(button).toHaveAccessibleName();
          expect(button).toHaveAttribute('aria-describedby');
        });
      });

      it('announces connection status changes', async () => {
        render(
          <SocialAccountsManager
            user={mockUser}
            linkedAccounts={[]}
            onAccountLinked={jest.fn()}
            onAccountUnlinked={jest.fn()}
          />
        );

        const statusRegions = screen.getAllByRole('status');
        expect(statusRegions.length).toBeGreaterThan(0);
      });

      it('provides proper context for OAuth providers', () => {
        render(
          <SocialAccountsManager
            user={mockUser}
            linkedAccounts={[]}
            onAccountLinked={jest.fn()}
            onAccountUnlinked={jest.fn()}
          />
        );

        // Each provider section should have proper headings
        const providerHeadings = screen.getAllByRole('heading', { level: 3 });
        providerHeadings.forEach(heading => {
          expect(heading).toBeInTheDocument();
        });
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports proper tab order throughout profile management', async () => {
      const user = userEvent.setup();
      renderWithUser(<ProfileManager user={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText('Profile Management')).toBeInTheDocument();
      });

      // Tab through all focusable elements
      const focusableElements = screen.getAllByRole('button');
      
      for (let i = 0; i < Math.min(focusableElements.length, 5); i++) {
        await user.tab();
        expect(document.activeElement).toBeInTheDocument();
        expect(document.activeElement).toBeVisible();
      }
    });

    it('provides skip links for main content areas', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
    });

    it('traps focus in modal dialogs', async () => {
      const user = userEvent.setup();
      renderWithUser(<ProfileManager user={mockUser} />);

      // Open a modal (simulate)
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Focus should be trapped within modal
      await user.tab();
      await user.tab();
      await user.tab();
      
      // Focus should cycle back to first focusable element in modal
      const modalButtons = screen.getAllByRole('button');
      const focusedElement = document.activeElement;
      expect(modalButtons).toContain(focusedElement);
    });
  });

  describe('Screen Reader Support', () => {
    it('provides meaningful page titles', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);

      await waitFor(() => {
        expect(document.title).toContain('Profile');
      });
    });

    it('uses proper ARIA live regions for dynamic content', async () => {
      const user = userEvent.setup();
      renderWithUser(<ProfileManager user={mockUser} />);

      // Find live regions
      const liveRegions = screen.getAllByRole('status');
      expect(liveRegions.length).toBeGreaterThan(0);

      const politeRegions = screen.getAllByRole('status');
      politeRegions.forEach(region => {
        expect(region).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('announces form validation errors appropriately', async () => {
      const user = userEvent.setup();
      render(
        <ProfileEditForm
          user={mockUser}
          profile={mockProfile}
          onUpdate={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        const errorRegion = screen.getByRole('alert');
        expect(errorRegion).toBeInTheDocument();
        expect(errorRegion).toHaveTextContent(/invalid email/i);
      });
    });

    it('provides context for complex interactions', async () => {
      render(
        <AvatarUpload
          user={mockUser}
          onAvatarUpdate={jest.fn()}
          onAvatarDelete={jest.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/upload avatar/i);
      expect(fileInput).toHaveAttribute('aria-describedby');
      
      const description = document.getElementById(
        fileInput.getAttribute('aria-describedby')!
      );
      expect(description).toHaveTextContent(/supported formats/i);
    });
  });

  describe('Color Contrast and Visual Design', () => {
    it('ensures sufficient color contrast for text', async () => {
      const { container } = renderWithUser(<ProfileManager user={mockUser} />);

      // This would typically be tested with automated tools like axe
      // which check color contrast ratios
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('does not rely solely on color to convey information', () => {
      render(
        <AccountSettings
          user={mockUser}
          preferences={mockProfile.preferences}
          onPreferencesUpdate={jest.fn()}
        />
      );

      // Status indicators should use icons or text in addition to color
      const successIndicators = screen.getAllByRole('status');
      successIndicators.forEach(indicator => {
        // Should have textual content or aria-label
        expect(
          indicator.textContent ||
          indicator.getAttribute('aria-label') ||
          indicator.querySelector('svg')
        ).toBeTruthy();
      });
    });

    it('supports high contrast mode preferences', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderWithUser(<ProfileManager user={mockUser} />);

      // Component should adapt to high contrast preference
      await waitFor(() => {
        const container = screen.getByText('Profile Management').closest('div');
        expect(container).toHaveClass('high-contrast');
      });
    });
  });

  describe('Motion and Animation Accessibility', () => {
    it('respects reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderWithUser(<ProfileManager user={mockUser} />);

      // Animations should be disabled or reduced
      await waitFor(() => {
        const animatedElements = document.querySelectorAll('[class*="animate"]');
        animatedElements.forEach(element => {
          expect(element).toHaveClass('motion-reduce');
        });
      });
    });

    it('provides alternative interaction methods for gesture-based controls', async () => {
      render(
        <AvatarUpload
          user={mockUser}
          onAvatarUpdate={jest.fn()}
          onAvatarDelete={jest.fn()}
        />
      );

      // Drag and drop should have keyboard alternatives
      const fileInput = screen.getByLabelText(/upload avatar/i);
      expect(fileInput).toBeInTheDocument();

      const browseButton = screen.getByRole('button', { name: /browse files/i });
      expect(browseButton).toBeInTheDocument();
    });
  });

  describe('Mobile Accessibility', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    it('maintains accessibility on mobile devices', async () => {
      const { container } = renderWithUser(<ProfileManager user={mockUser} />);

      const results = await axe(container, {
        rules: {
          'target-size': { enabled: true }, // Check touch target sizes
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('provides adequate touch target sizes', async () => {
      renderWithUser(<ProfileManager user={mockUser} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // WCAG recommends minimum 44x44 CSS pixels
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      });
    });

    it('supports swipe gestures with keyboard alternatives', async () => {
      const user = userEvent.setup();
      renderWithUser(<ProfileManager user={mockUser} />);

      // Tab navigation should work as alternative to swiping
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();

      await user.keyboard('{ArrowRight}');
      expect(tabs[1]).toHaveFocus();
    });
  });

  describe('Error Prevention and Recovery', () => {
    it('provides clear error messages with recovery suggestions', async () => {
      const user = userEvent.setup();
      render(
        <ProfileEditForm
          user={mockUser}
          profile={mockProfile}
          onUpdate={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const phoneInput = screen.getByLabelText(/phone/i);
      await user.clear(phoneInput);
      await user.type(phoneInput, 'invalid-phone');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent(/invalid phone/i);
        expect(errorMessage).toHaveTextContent(/format/i); // Should suggest correct format
      });
    });

    it('confirms destructive actions with accessible dialogs', async () => {
      const user = userEvent.setup();
      renderWithUser(<ProfileManager user={mockUser} />);

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(dialog).toHaveAttribute('aria-describedby');
        
        // Focus should move to dialog
        expect(dialog).toContainElement(document.activeElement);
      });
    });
  });
});