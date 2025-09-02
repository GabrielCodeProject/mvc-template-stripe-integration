import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import ProfileEditForm, { ProfileEditFormProps } from '../ProfileEditForm';
import { renderWithUser, createMockAction } from '@/test/utils/test-utils';
import { AuthUser } from '@/models/AuthUser';
import { UserProfile } from '@/models/UserProfile';

// Mock next-safe-action
const mockUpdateProfileAction = createMockAction();
const mockValidateProfileFieldAction = createMockAction();
const mockAddSocialLinkAction = createMockAction();
const mockRemoveSocialLinkAction = createMockAction();

jest.mock('next-safe-action/hooks', () => ({
  useAction: jest.fn((action) => {
    if (action.toString().includes('updateProfile')) return mockUpdateProfileAction;
    if (action.toString().includes('validateProfileField')) return mockValidateProfileFieldAction;
    if (action.toString().includes('addSocialLink')) return mockAddSocialLinkAction;
    if (action.toString().includes('removeSocialLink')) return mockRemoveSocialLinkAction;
    return createMockAction();
  }),
}));

describe('ProfileEditForm', () => {
  const mockUser: AuthUser = {
    id: 'test-user-123',
    name: 'John Doe',
    email: 'john@example.com',
    image: 'https://example.com/avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: UserProfile = {
    userId: 'test-user-123',
    firstName: 'John',
    lastName: 'Doe',
    bio: 'Software developer passionate about creating great user experiences.',
    dateOfBirth: new Date('1990-05-15'),
    phone: '+1234567890',
    location: 'San Francisco, CA',
    avatarUrl: 'https://example.com/avatar.jpg',
    socialLinks: {
      twitter: 'https://twitter.com/johndoe',
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
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

  const defaultProps: ProfileEditFormProps = {
    user: mockUser,
    profile: mockProfile,
    onUpdate: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfileAction.status = 'idle';
    mockValidateProfileFieldAction.status = 'idle';
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      expect(container).toBeDefined();
    });

    it('displays form title and description', () => {
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByText(/Update your personal information/i)).toBeInTheDocument();
    });

    it('pre-fills form fields with existing profile data', () => {
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Software developer passionate about creating great user experiences.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
      expect(screen.getByDisplayValue('San Francisco, CA')).toBeInTheDocument();
    });

    it('displays social media links section', () => {
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      expect(screen.getByText('Social Media Links')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://twitter.com/johndoe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://linkedin.com/in/johndoe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://github.com/johndoe')).toBeInTheDocument();
    });

    it('shows form action buttons', () => {
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      // Clear first name (required field)
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      
      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      });
    });

    it('validates email format', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      
      await user.tab(); // Trigger blur event
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
      });
    });

    it('validates phone number format', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const phoneInput = screen.getByLabelText(/phone/i);
      await user.clear(phoneInput);
      await user.type(phoneInput, '123'); // Invalid format
      
      await user.tab(); // Trigger blur event
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument();
      });
    });

    it('validates social media URLs', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const twitterInput = screen.getByLabelText(/twitter/i);
      await user.clear(twitterInput);
      await user.type(twitterInput, 'invalid-url');
      
      await user.tab(); // Trigger blur event
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid twitter url/i)).toBeInTheDocument();
      });
    });

    it('validates date of birth', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const dobInput = screen.getByLabelText(/date of birth/i);
      await user.clear(dobInput);
      await user.type(dobInput, '2030-01-01'); // Future date
      
      await user.tab(); // Trigger blur event
      
      await waitFor(() => {
        expect(screen.getByText(/date of birth cannot be in the future/i)).toBeInTheDocument();
      });
    });

    it('shows validation success indicators', async () => {
      mockValidateProfileFieldAction.result = {
        data: { isValid: true },
      };
      
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Valid Name');
      
      await user.tab(); // Trigger validation
      
      await waitFor(() => {
        const successIcon = screen.getByText('✓');
        expect(successIcon).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      mockUpdateProfileAction.result = {
        data: { success: true, profile: mockProfile },
      };
      
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      // Modify a field
      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.type(bioInput, 'Updated bio content');
      
      // Submit form
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockUpdateProfileAction.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            bio: 'Updated bio content',
          })
        );
      });
    });

    it('shows loading state during submission', async () => {
      mockUpdateProfileAction.status = 'executing';
      
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const saveButton = screen.getByRole('button', { name: /saving.../i });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveClass('disabled:opacity-50');
    });

    it('handles submission success', async () => {
      const mockOnUpdate = jest.fn();
      mockUpdateProfileAction.result = {
        data: { success: true, profile: mockProfile },
      };
      mockUpdateProfileAction.status = 'hasSucceeded';
      
      const { user } = renderWithUser(
        <ProfileEditForm {...defaultProps} onUpdate={mockOnUpdate} />
      );
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(mockProfile);
      });
    });

    it('handles submission errors', async () => {
      mockUpdateProfileAction.result = {
        data: { success: false, error: 'Update failed' },
      };
      mockUpdateProfileAction.status = 'hasErrored';
      
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });
    });

    it('prevents submission with validation errors', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      // Clear required field
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);
      
      expect(mockUpdateProfileAction.execute).not.toHaveBeenCalled();
    });
  });

  describe('Social Links Management', () => {
    it('adds new social links', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const addButton = screen.getByRole('button', { name: /add social link/i });
      await user.click(addButton);
      
      // Fill in the new social link form
      const platformSelect = screen.getByLabelText(/platform/i);
      const urlInput = screen.getByLabelText(/url/i);
      
      await user.selectOptions(platformSelect, 'facebook');
      await user.type(urlInput, 'https://facebook.com/johndoe');
      
      const confirmButton = screen.getByRole('button', { name: /add link/i });
      await user.click(confirmButton);
      
      expect(mockAddSocialLinkAction.execute).toHaveBeenCalledWith({
        platform: 'facebook',
        url: 'https://facebook.com/johndoe',
      });
    });

    it('removes existing social links', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]); // Remove first social link
      
      expect(mockRemoveSocialLinkAction.execute).toHaveBeenCalledWith({
        platform: 'twitter',
      });
    });

    it('validates social link URLs before adding', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const addButton = screen.getByRole('button', { name: /add social link/i });
      await user.click(addButton);
      
      const platformSelect = screen.getByLabelText(/platform/i);
      const urlInput = screen.getByLabelText(/url/i);
      
      await user.selectOptions(platformSelect, 'twitter');
      await user.type(urlInput, 'invalid-url'); // Invalid Twitter URL
      
      const confirmButton = screen.getByRole('button', { name: /add link/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/please enter a valid twitter url/i)).toBeInTheDocument();
      });
      
      expect(mockAddSocialLinkAction.execute).not.toHaveBeenCalled();
    });
  });

  describe('Form Cancellation', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const mockOnCancel = jest.fn();
      const { user } = renderWithUser(
        <ProfileEditForm {...defaultProps} onCancel={mockOnCancel} />
      );
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('shows confirmation dialog when form has changes', async () => {
      const mockOnCancel = jest.fn();
      const { user } = renderWithUser(
        <ProfileEditForm {...defaultProps} onCancel={mockOnCancel} />
      );
      
      // Make a change
      const bioInput = screen.getByLabelText(/bio/i);
      await user.type(bioInput, ' Modified');
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.getByText(/discard changes/i)).toBeInTheDocument();
      });
    });

    it('resets form when confirmed to discard changes', async () => {
      const mockOnCancel = jest.fn();
      const { user } = renderWithUser(
        <ProfileEditForm {...defaultProps} onCancel={mockOnCancel} />
      );
      
      // Make a change
      const bioInput = screen.getByLabelText(/bio/i);
      await user.clear(bioInput);
      await user.type(bioInput, 'Changed bio');
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      // Confirm discard
      const discardButton = screen.getByRole('button', { name: /discard/i });
      await user.click(discardButton);
      
      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper form labels and descriptions', () => {
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    });

    it('shows error messages with proper ARIA attributes', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      // Trigger validation error
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      await user.tab();
      
      await waitFor(() => {
        const errorMessage = screen.getByText(/first name is required/i);
        expect(errorMessage).toBeInTheDocument();
        expect(firstNameInput).toHaveAttribute('aria-describedby');
        expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('supports keyboard navigation', async () => {
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      
      firstNameInput.focus();
      expect(firstNameInput).toHaveFocus();
      
      await user.tab();
      expect(lastNameInput).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      // Check for mobile-responsive classes
      const formContainer = screen.getByText('Edit Profile').closest('form');
      expect(formContainer).toHaveClass('space-y-6');
    });
  });

  describe('Data Persistence', () => {
    it('auto-saves form data locally', async () => {
      const localStorageSpy = jest.spyOn(Storage.prototype, 'setItem');
      
      const { user } = renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      const bioInput = screen.getByLabelText(/bio/i);
      await user.type(bioInput, ' Auto-saved content');
      
      await waitFor(() => {
        expect(localStorageSpy).toHaveBeenCalledWith(
          expect.stringContaining('profile-draft'),
          expect.any(String)
        );
      });
      
      localStorageSpy.mockRestore();
    });

    it('restores draft data on component mount', () => {
      const draftData = {
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Restored draft content',
      };
      
      const localStorageSpy = jest.spyOn(Storage.prototype, 'getItem')
        .mockReturnValue(JSON.stringify(draftData));
      
      renderWithUser(<ProfileEditForm {...defaultProps} />);
      
      expect(screen.getByDisplayValue('Restored draft content')).toBeInTheDocument();
      
      localStorageSpy.mockRestore();
    });
  });
});