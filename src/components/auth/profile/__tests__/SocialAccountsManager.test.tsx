import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import SocialAccountsManager from '../SocialAccountsManager';
import { renderWithUser, createMockAction } from '@/test/utils/test-utils';
import { AuthUser } from '@/models/AuthUser';
import { LinkedAccount } from '@/models/UserProfile';

// Mock next-safe-action
const mockLinkOAuthAccountAction = createMockAction();
const mockUnlinkOAuthAccountAction = createMockAction();

jest.mock('next-safe-action/hooks', () => ({
  useAction: jest.fn((action) => {
    if (action.toString().includes('linkOAuth')) return mockLinkOAuthAccountAction;
    if (action.toString().includes('unlinkOAuth')) return mockUnlinkOAuthAccountAction;
    return createMockAction();
  }),
}));

// Mock ConfirmDialog
jest.mock('../../shared/ConfirmDialog', () => {
  return function MockConfirmDialog(props: any) {
    if (!props.isOpen) return null;
    
    return (
      <div data-testid="confirm-dialog">
        <h2>{props.title}</h2>
        <p>{props.message}</p>
        <button onClick={props.onConfirm} disabled={props.isLoading}>
          {props.isLoading ? 'Loading...' : 'Confirm'}
        </button>
        <button onClick={props.onClose}>Cancel</button>
      </div>
    );
  };
});

// Mock window.open for OAuth popup
const mockWindowOpen = jest.fn();
const mockPopup = {
  closed: false,
  close: jest.fn(),
  location: { href: 'https://example.com' },
  postMessage: jest.fn(),
};

Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen.mockReturnValue(mockPopup),
});

// Mock message event listener
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
Object.defineProperty(window, 'addEventListener', {
  writable: true,
  value: mockAddEventListener,
});
Object.defineProperty(window, 'removeEventListener', {
  writable: true,
  value: mockRemoveEventListener,
});

describe('SocialAccountsManager', () => {
  const mockUser: AuthUser = {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    image: 'https://example.com/avatar.jpg',
    emailVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLinkedAccounts: LinkedAccount[] = [
    {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@gmail.com',
      name: 'Test User',
      avatar: 'https://example.com/google-avatar.jpg',
      linkedAt: new Date('2023-01-01'),
    },
    {
      provider: 'github',
      providerId: 'github-123',
      email: 'test@github-email.com',
      name: 'Test User',
      avatar: 'https://example.com/github-avatar.jpg',
      linkedAt: new Date('2023-01-15'),
    },
  ];

  const defaultProps = {
    user: mockUser,
    linkedAccounts: mockLinkedAccounts,
    onAccountLinked: jest.fn(),
    onAccountUnlinked: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLinkOAuthAccountAction.status = 'idle';
    mockUnlinkOAuthAccountAction.status = 'idle';
    mockPopup.closed = false;
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      expect(container).toBeDefined();
    });

    it('displays OAuth providers', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      expect(screen.getByText('Google')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText('Twitter')).toBeInTheDocument();
    });

    it('shows provider descriptions and features', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      expect(screen.getByText(/connect your google account/i)).toBeInTheDocument();
      expect(screen.getByText(/profile sync/i)).toBeInTheDocument();
      expect(screen.getByText(/email integration/i)).toBeInTheDocument();
    });

    it('displays connected accounts correctly', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      // Google should show as connected
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      expect(within(googleSection).getByText('Connected')).toBeInTheDocument();
      expect(within(googleSection).getByText('test@gmail.com')).toBeInTheDocument();
      
      // GitHub should show as connected
      const githubSection = screen.getByText('GitHub').closest('[data-provider="github"]');
      expect(within(githubSection).getByText('Connected')).toBeInTheDocument();
      expect(within(githubSection).getByText('test@github-email.com')).toBeInTheDocument();
    });

    it('displays unconnected accounts correctly', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      // LinkedIn should show as not connected
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      expect(within(linkedinSection).getByRole('button', { name: /connect/i })).toBeInTheDocument();
      
      // Twitter should show as not connected
      const twitterSection = screen.getByText('Twitter').closest('[data-provider="twitter"]');
      expect(within(twitterSection).getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });

    it('shows account connection timestamps', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      expect(screen.getByText(/connected on/i)).toBeInTheDocument();
    });
  });

  describe('Account Linking', () => {
    it('initiates OAuth flow when connect button is clicked', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(connectButton);
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('/api/oauth/linkedin'),
        'oauth_popup',
        expect.stringContaining('width=600,height=700')
      );
    });

    it('shows connecting state during OAuth flow', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(within(linkedinSection).getByText('Connecting...')).toBeInTheDocument();
        expect(connectButton).toBeDisabled();
      });
    });

    it('handles successful account linking', async () => {
      const mockAccount: LinkedAccount = {
        provider: 'linkedin',
        providerId: 'linkedin-456',
        email: 'test@linkedin.com',
        name: 'Test User',
        avatar: 'https://example.com/linkedin-avatar.jpg',
        linkedAt: new Date(),
      };

      mockLinkOAuthAccountAction.result = {
        data: { success: true, account: mockAccount },
      };

      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(connectButton);
      
      // Simulate OAuth completion
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: { type: 'oauth_success', provider: 'linkedin' },
          origin: window.location.origin,
        });
      }

      await waitFor(() => {
        expect(defaultProps.onAccountLinked).toHaveBeenCalledWith(mockAccount);
        expect(screen.getByText(/linkedin account connected/i)).toBeInTheDocument();
      });
    });

    it('handles OAuth errors', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(connectButton);
      
      // Simulate OAuth error
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: { 
            type: 'oauth_error', 
            provider: 'linkedin', 
            error: 'Access denied' 
          },
          origin: window.location.origin,
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/failed to connect linkedin/i)).toBeInTheDocument();
      });
    });

    it('handles popup blocking', async () => {
      mockWindowOpen.mockReturnValueOnce(null);
      
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText(/popup blocked/i)).toBeInTheDocument();
      });
    });

    it('cleans up popup window on unmount', () => {
      const { unmount } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      unmount();
      
      expect(mockPopup.close).toHaveBeenCalled();
    });
  });

  describe('Account Unlinking', () => {
    it('shows confirmation dialog when disconnect is clicked', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const disconnectButton = within(googleSection).getByRole('button', { name: /disconnect/i });
      
      await user.click(disconnectButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/disconnect google/i)).toBeInTheDocument();
      });
    });

    it('prevents unlinking when it would leave user with no authentication methods', async () => {
      // User with only one linked account and no email verification
      const singleAccountUser = {
        ...mockUser,
        emailVerified: null,
      };
      
      const singleLinkedAccount = [mockLinkedAccounts[0]];
      
      const { user } = renderWithUser(
        <SocialAccountsManager 
          {...defaultProps} 
          user={singleAccountUser}
          linkedAccounts={singleLinkedAccount} 
        />
      );
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const disconnectButton = within(googleSection).getByRole('button', { name: /disconnect/i });
      
      await user.click(disconnectButton);
      
      await waitFor(() => {
        expect(screen.getByText(/cannot disconnect/i)).toBeInTheDocument();
        expect(screen.getByText(/last authentication method/i)).toBeInTheDocument();
      });
    });

    it('successfully disconnects account', async () => {
      mockUnlinkOAuthAccountAction.result = {
        data: { success: true, provider: 'google' },
      };

      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const disconnectButton = within(googleSection).getByRole('button', { name: /disconnect/i });
      
      await user.click(disconnectButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockUnlinkOAuthAccountAction.execute).toHaveBeenCalledWith({
          provider: 'google',
        });
        expect(defaultProps.onAccountUnlinked).toHaveBeenCalledWith('google');
        expect(screen.getByText(/google account disconnected/i)).toBeInTheDocument();
      });
    });

    it('handles disconnection errors', async () => {
      mockUnlinkOAuthAccountAction.result = {
        data: { success: false, error: 'Disconnection failed' },
      };
      mockUnlinkOAuthAccountAction.status = 'hasErrored';

      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const disconnectButton = within(googleSection).getByRole('button', { name: /disconnect/i });
      
      await user.click(disconnectButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to disconnect/i)).toBeInTheDocument();
      });
    });

    it('shows loading state during disconnection', async () => {
      mockUnlinkOAuthAccountAction.status = 'executing';

      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const disconnectButton = within(googleSection).getByRole('button', { name: /disconnect/i });
      
      await user.click(disconnectButton);
      
      const confirmButton = screen.getByRole('button', { name: /loading.../i });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Security Features', () => {
    it('displays security warnings for account connections', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      expect(screen.getByText(/connecting accounts allows/i)).toBeInTheDocument();
      expect(screen.getByText(/review permissions/i)).toBeInTheDocument();
    });

    it('shows last sync information', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      expect(within(googleSection).getByText(/last sync/i)).toBeInTheDocument();
    });

    it('displays account permissions', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const manageButton = within(googleSection).getByRole('button', { name: /manage/i });
      
      await user.click(manageButton);
      
      await waitFor(() => {
        expect(screen.getByText(/permissions/i)).toBeInTheDocument();
        expect(screen.getByText(/profile access/i)).toBeInTheDocument();
        expect(screen.getByText(/email access/i)).toBeInTheDocument();
      });
    });
  });

  describe('Account Synchronization', () => {
    it('shows sync status for connected accounts', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      expect(within(googleSection).getByText(/in sync/i)).toBeInTheDocument();
    });

    it('allows manual sync trigger', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const syncButton = within(googleSection).getByRole('button', { name: /sync now/i });
      
      await user.click(syncButton);
      
      await waitFor(() => {
        expect(screen.getByText(/syncing.../i)).toBeInTheDocument();
      });
    });

    it('displays sync conflicts', async () => {
      const conflictAccounts = [
        {
          ...mockLinkedAccounts[0],
          syncStatus: 'conflict',
          syncError: 'Email mismatch detected',
        },
      ];

      const { user } = renderWithUser(
        <SocialAccountsManager 
          {...defaultProps} 
          linkedAccounts={conflictAccounts}
        />
      );
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      expect(within(googleSection).getByText(/sync conflict/i)).toBeInTheDocument();
      
      const resolveButton = within(googleSection).getByRole('button', { name: /resolve/i });
      await user.click(resolveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/email mismatch detected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      connectButton.focus();
      expect(connectButton).toHaveFocus();
      
      await user.keyboard('{Tab}');
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const disconnectButton = within(googleSection).getByRole('button', { name: /disconnect/i });
      expect(disconnectButton).toHaveFocus();
    });

    it('has proper ARIA labels and descriptions', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const connectButtons = screen.getAllByRole('button', { name: /connect/i });
      connectButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-describedby');
      });
      
      const disconnectButtons = screen.getAllByRole('button', { name: /disconnect/i });
      disconnectButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-describedby');
      });
    });

    it('announces connection status to screen readers', () => {
      renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const statusRegion = within(googleSection).getByRole('status');
      expect(statusRegion).toHaveTextContent(/connected/i);
    });
  });

  describe('Error Recovery', () => {
    it('allows retry after connection failure', async () => {
      mockLinkOAuthAccountAction.result = {
        data: { success: false, error: 'Connection failed' },
      };

      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(connectButton);
      
      // Simulate connection failure
      const messageHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: { 
            type: 'oauth_error', 
            provider: 'linkedin', 
            error: 'Connection failed' 
          },
          origin: window.location.origin,
        });
      }

      await waitFor(() => {
        expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
      });
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      expect(mockWindowOpen).toHaveBeenCalledTimes(2);
    });

    it('clears errors when switching providers', async () => {
      mockLinkOAuthAccountAction.result = {
        data: { success: false, error: 'Connection failed' },
      };

      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      // Trigger error with LinkedIn
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const linkedinConnectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      await user.click(linkedinConnectButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
      });
      
      // Try connecting Twitter
      const twitterSection = screen.getByText('Twitter').closest('[data-provider="twitter"]');
      const twitterConnectButton = within(twitterSection).getByRole('button', { name: /connect/i });
      
      await user.click(twitterConnectButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/failed to connect/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('efficiently updates only affected provider sections', async () => {
      const { user } = renderWithUser(<SocialAccountsManager {...defaultProps} />);
      
      const linkedinSection = screen.getByText('LinkedIn').closest('[data-provider="linkedin"]');
      const connectButton = within(linkedinSection).getByRole('button', { name: /connect/i });
      
      // Other provider sections should not re-render
      const googleSection = screen.getByText('Google').closest('[data-provider="google"]');
      const originalGoogleHTML = googleSection.innerHTML;
      
      await user.click(connectButton);
      
      // Google section should remain unchanged
      expect(googleSection.innerHTML).toBe(originalGoogleHTML);
    });
  });
});