"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { AuthUser } from "@/models/AuthUser";
import { LinkedAccount } from "@/models/UserProfile";
import { linkOAuthAccountAction, unlinkOAuthAccountAction } from "@/actions/profile.actions";
import ConfirmDialog from "@/components/auth/shared/ConfirmDialog";

// Types and Interfaces
interface SocialAccountsManagerProps {
  user: AuthUser;
  linkedAccounts?: LinkedAccount[];
  onAccountLinked?: (account: LinkedAccount) => void;
  onAccountUnlinked?: (providerId: string) => void;
  className?: string;
}

interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
  features: string[];
}

interface OAuthFlowState {
  isConnecting: boolean;
  provider: string | null;
  popup: Window | null;
  error: string | null;
  success: string | null;
}

interface AccountStatus {
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  lastSync?: Date;
  error?: string;
}

// OAuth Provider Configuration
const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: '🌐',
    color: 'border-red-200',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    description: 'Connect your Google account for profile synchronization',
    features: ['Profile sync', 'Email integration', 'Calendar access']
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙', 
    color: 'border-gray-200',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    description: 'Link your GitHub profile for developer integration',
    features: ['Repository access', 'Profile sync', 'Activity tracking']
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    color: 'border-blue-200', 
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    description: 'Connect LinkedIn for professional networking',
    features: ['Professional profile', 'Network sync', 'Job integration']
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: '🐦',
    color: 'border-sky-200',
    bgColor: 'bg-sky-50', 
    textColor: 'text-sky-700',
    description: 'Link Twitter for social media presence',
    features: ['Tweet integration', 'Profile sync', 'Social analytics']
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: 'border-blue-200',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    description: 'Connect Facebook for social connections',
    features: ['Social graph', 'Profile sync', 'Event integration']
  },
];

export default function SocialAccountsManager({
  user,
  linkedAccounts = [],
  onAccountLinked,
  onAccountUnlinked,
  className = ""
}: SocialAccountsManagerProps) {
  // State management
  const [oauthState, setOAuthState] = useState<OAuthFlowState>({
    isConnecting: false,
    provider: null,
    popup: null,
    error: null,
    success: null,
  });
  
  const [accountStatuses, setAccountStatuses] = useState<Map<string, AccountStatus>>(
    new Map()
  );
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    provider?: string;
    account?: LinkedAccount;
  }>({ isOpen: false });

  // Server actions
  const { execute: linkOAuthAccount, status: linkStatus, result: linkResult } = 
    useAction(linkOAuthAccountAction);
  const { execute: unlinkOAuthAccount, status: unlinkStatus } = 
    useAction(unlinkOAuthAccountAction);

  // Initialize account statuses
  useEffect(() => {
    const statusMap = new Map<string, AccountStatus>();
    
    OAUTH_PROVIDERS.forEach(provider => {
      const linkedAccount = linkedAccounts.find(acc => acc.provider === provider.id);
      statusMap.set(provider.id, {
        isConnected: !!linkedAccount,
        isConnecting: false,
        isDisconnecting: false,
        lastSync: linkedAccount?.lastSyncAt,
      });
    });
    
    setAccountStatuses(statusMap);
  }, [linkedAccounts]);

  // Handle OAuth linking result
  useEffect(() => {
    if (linkResult?.data?.success && oauthState.provider) {
      setOAuthState(prev => ({
        ...prev,
        success: `Successfully connected ${oauthState.provider} account!`,
        error: null,
        isConnecting: false,
      }));
      
      // Update account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(oauthState.provider!, {
          isConnected: true,
          isConnecting: false,
          isDisconnecting: false,
          lastSync: new Date(),
        });
        return updated;
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        setOAuthState(prev => ({ ...prev, success: null, provider: null }));
      }, 5000);

      // Notify parent component
      if (onAccountLinked && linkResult.data.linkedAccount) {
        onAccountLinked(linkResult.data.linkedAccount);
      }
    }
    
    if (linkResult?.data && !linkResult.data.success) {
      setOAuthState(prev => ({
        ...prev,
        error: 'Failed to connect account. Please try again.',
        isConnecting: false,
      }));
      
      // Update account status
      if (oauthState.provider) {
        setAccountStatuses(prev => {
          const updated = new Map(prev);
          updated.set(oauthState.provider!, {
            ...prev.get(oauthState.provider!) || { isConnected: false, isConnecting: false, isDisconnecting: false },
            isConnecting: false,
            error: 'Connection failed',
          });
          return updated;
        });
      }
    }
  }, [linkResult, oauthState.provider, onAccountLinked]);

  // Handle OAuth popup message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      const { type, provider, code, state, error } = event.data;
      
      if (type === 'oauth-callback' && provider === oauthState.provider) {
        // Close popup
        if (oauthState.popup) {
          oauthState.popup.close();
        }
        
        if (error) {
          setOAuthState(prev => ({
            ...prev,
            error: `OAuth error: ${error}`,
            isConnecting: false,
            popup: null,
          }));
        } else if (code && state) {
          // Complete OAuth flow by calling the backend
          handleOAuthCallback(provider, code, state);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [oauthState.provider, oauthState.popup]);

  // Initiate OAuth flow
  const initiateOAuthFlow = useCallback(async (provider: string) => {
    try {
      setOAuthState(prev => ({
        ...prev,
        isConnecting: true,
        provider,
        error: null,
        success: null,
      }));

      // Update account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(provider, {
          ...prev.get(provider) || { isConnected: false, isConnecting: false, isDisconnecting: false },
          isConnecting: true,
          error: undefined,
        });
        return updated;
      });

      // Get OAuth authorization URL from backend
      const response = await fetch(`/api/oauth/link/${provider}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to initiate OAuth flow');
      }

      // Open OAuth popup
      const popup = window.open(
        result.authUrl,
        `oauth-${provider}`,
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for OAuth authentication.');
      }

      setOAuthState(prev => ({
        ...prev,
        popup,
      }));

      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setOAuthState(prev => {
            if (prev.isConnecting) {
              return {
                ...prev,
                isConnecting: false,
                error: 'OAuth authentication was cancelled',
                popup: null,
              };
            }
            return { ...prev, popup: null };
          });
          
          // Update account status
          setAccountStatuses(prevStatuses => {
            const updated = new Map(prevStatuses);
            const currentStatus = updated.get(provider);
            if (currentStatus?.isConnecting) {
              updated.set(provider, {
                ...currentStatus,
                isConnecting: false,
                error: 'Authentication cancelled',
              });
            }
            return updated;
          });
        }
      }, 1000);

    } catch (error) {
      console.error('OAuth initiation error:', error);
      setOAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start OAuth flow',
        isConnecting: false,
        popup: null,
      }));
      
      // Update account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(provider, {
          ...prev.get(provider) || { isConnected: false, isConnecting: false, isDisconnecting: false },
          isConnecting: false,
          error: 'Failed to start authentication',
        });
        return updated;
      });
    }
  }, []);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async (provider: string, code: string, state: string) => {
    try {
      // Send callback data to backend for processing
      const response = await fetch(`/api/oauth/link/${provider}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      const result = await response.json();

      if (result.success) {
        setOAuthState(prev => ({
          ...prev,
          success: `Successfully connected ${provider} account!`,
          error: null,
          isConnecting: false,
          popup: null,
        }));

        // Update account status
        setAccountStatuses(prev => {
          const updated = new Map(prev);
          updated.set(provider, {
            isConnected: true,
            isConnecting: false,
            isDisconnecting: false,
            lastSync: new Date(),
          });
          return updated;
        });

        // Clear success message after 5 seconds
        setTimeout(() => {
          setOAuthState(prev => ({ ...prev, success: null, provider: null }));
        }, 5000);

        // Notify parent component
        if (onAccountLinked && result.linkedAccount) {
          onAccountLinked(result.linkedAccount);
        }
      } else {
        throw new Error(result.error || 'Failed to complete OAuth flow');
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      setOAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to complete authentication',
        isConnecting: false,
        popup: null,
      }));
      
      // Update account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(provider, {
          ...prev.get(provider) || { isConnected: false, isConnecting: false, isDisconnecting: false },
          isConnecting: false,
          error: 'Authentication failed',
        });
        return updated;
      });
    }
  }, [onAccountLinked]);

  // Handle account unlinking
  const handleUnlinkAccount = useCallback(async (provider: string) => {
    try {
      // Update account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(provider, {
          ...prev.get(provider) || { isConnected: true, isConnecting: false, isDisconnecting: false },
          isDisconnecting: true,
        });
        return updated;
      });

      // Call unlink action
      await unlinkOAuthAccount({ provider });

      // Update account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(provider, {
          isConnected: false,
          isConnecting: false,
          isDisconnecting: false,
        });
        return updated;
      });

      setOAuthState(prev => ({
        ...prev,
        success: `Successfully disconnected ${provider} account`,
        error: null,
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setOAuthState(prev => ({ ...prev, success: null }));
      }, 3000);

      // Notify parent component
      if (onAccountUnlinked) {
        onAccountUnlinked(provider);
      }

    } catch (error) {
      console.error('Account unlink error:', error);
      
      // Revert account status
      setAccountStatuses(prev => {
        const updated = new Map(prev);
        updated.set(provider, {
          isConnected: true,
          isConnecting: false,
          isDisconnecting: false,
          error: 'Failed to disconnect',
        });
        return updated;
      });

      setOAuthState(prev => ({
        ...prev,
        error: `Failed to disconnect ${provider} account`,
      }));
    }
  }, [unlinkOAuthAccount, onAccountUnlinked]);

  // Render provider card
  const renderProviderCard = (provider: OAuthProvider) => {
    const linkedAccount = linkedAccounts.find(acc => acc.provider === provider.id);
    const accountStatus = accountStatuses.get(provider.id) || {
      isConnected: false,
      isConnecting: false,
      isDisconnecting: false,
    };

    return (
      <div
        key={provider.id}
        className={`relative p-6 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
          accountStatus.isConnected 
            ? `${provider.bgColor} ${provider.color} border-opacity-50`
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        {/* Provider Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
              accountStatus.isConnected 
                ? 'bg-white bg-opacity-50' 
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              {provider.icon}
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${
                accountStatus.isConnected 
                  ? provider.textColor 
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {provider.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {provider.description}
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            accountStatus.isConnected
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {accountStatus.isConnected ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        {/* Connected Account Info */}
        {accountStatus.isConnected && linkedAccount && (
          <div className="mb-4 p-3 bg-white bg-opacity-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {linkedAccount.avatarUrl && (
                <Image
                  src={linkedAccount.avatarUrl}
                  alt={linkedAccount.displayName || 'Profile'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {linkedAccount.displayName || linkedAccount.providerEmail || 'Connected Account'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Connected {new Date(linkedAccount.linkedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Features List */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Features:</p>
          <div className="flex flex-wrap gap-2">
            {provider.features.map((feature, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-md text-gray-600 dark:text-gray-400"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {accountStatus.error && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-600">{accountStatus.error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          {accountStatus.isConnected ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setConfirmDialog({
                  isOpen: true,
                  provider: provider.id,
                  account: linkedAccount,
                })}
                disabled={accountStatus.isDisconnecting}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accountStatus.isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
              
              <button
                onClick={() => {/* Implement refresh/resync */}}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                title="Refresh connection"
              >
                🔄
              </button>
            </div>
          ) : (
            <button
              onClick={() => initiateOAuthFlow(provider.id)}
              disabled={accountStatus.isConnecting || oauthState.isConnecting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {accountStatus.isConnecting 
                ? 'Connecting...' 
                : 'Connect Account'
              }
            </button>
          )}

          {/* Last Sync Info */}
          {accountStatus.lastSync && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last sync: {accountStatus.lastSync.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Social Accounts
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Connect your accounts from other services to enhance your profile
          </p>
        </div>
        
        {/* Connected Count */}
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {linkedAccounts.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Connected
          </div>
        </div>
      </div>

      {/* Global Messages */}
      {oauthState.success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-green-400 mr-3">✅</div>
            <p className="text-green-800 text-sm font-medium">
              {oauthState.success}
            </p>
          </div>
        </div>
      )}

      {oauthState.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">❌</div>
            <p className="text-red-800 text-sm font-medium">
              {oauthState.error}
            </p>
            <button
              onClick={() => setOAuthState(prev => ({ ...prev, error: null }))}
              className="ml-auto text-red-600 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {OAUTH_PROVIDERS.map(renderProviderCard)}
      </div>

      {/* Account Management Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
          Account Management Tips
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start space-x-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Connected accounts help enhance your profile with additional information</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>You can disconnect any account at any time without affecting your main account</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Refresh connections periodically to keep your profile data up to date</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>All OAuth connections are secured with industry-standard encryption</span>
          </li>
        </ul>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false })}
        onConfirm={() => {
          if (confirmDialog.provider) {
            handleUnlinkAccount(confirmDialog.provider);
          }
          setConfirmDialog({ isOpen: false });
        }}
        title={`Disconnect ${confirmDialog.provider?.charAt(0).toUpperCase()}${confirmDialog.provider?.slice(1)} Account`}
        message={`Are you sure you want to disconnect your ${confirmDialog.provider} account? This will remove all associated data and features.`}
        confirmText="Disconnect"
        cancelText="Keep Connected"
        variant="danger"
        isLoading={unlinkStatus === 'executing'}
      />
    </div>
  );
}