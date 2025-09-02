"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { AuthUser } from "@/models/AuthUser";
import { UserProfile, SocialLinks, UserPreferences } from "@/models/UserProfile";
import {
  getProfileAction,
  updateSocialLinksAction,
  updatePreferencesAction,
  unlinkOAuthAccountAction,
  getProfileStatsAction,
} from "@/actions/profile.actions";
import {
  getUserAuditLogsAction,
} from "@/actions/security-audit.actions";
import ConfirmDialog from "@/components/auth/shared/ConfirmDialog";
import ProfileEditForm from "@/components/auth/forms/ProfileEditForm";
import AvatarUpload from "@/components/auth/profile/AvatarUpload";
import AccountSettings from "@/components/auth/profile/AccountSettings";
import SocialAccountsManager from "@/components/auth/profile/SocialAccountsManager";

// Types and Interfaces
interface ProfileManagerProps {
  className?: string;
  user?: AuthUser;
  onProfileUpdate?: (user: AuthUser) => void;
  initialTab?: string;
}

interface ProfileStats {
  completeness: number;
  linkedAccountsCount: number;
  age: number | null;
  lastUpdated: Date | undefined;
  recommendations: string[];
}




// Constants
const PROFILE_TABS = [
  { id: 'overview', name: 'Overview', icon: '👤', description: 'Profile summary and completion status' },
  { id: 'edit', name: 'Edit Profile', icon: '✏️', description: 'Update basic information' },
  { id: 'avatar', name: 'Avatar', icon: '🖼️', description: 'Profile picture management' },
  { id: 'social', name: 'Social Accounts', icon: '🔗', description: 'OAuth provider connections' },
  { id: 'preferences', name: 'Preferences', icon: '⚙️', description: 'Privacy and notification settings' },
  { id: 'activity', name: 'Activity', icon: '📊', description: 'Recent profile changes' },
];


const SUPPORTED_SOCIAL_PLATFORMS = [
  'twitter', 'linkedin', 'github', 'facebook', 'instagram', 'youtube', 'website'
];

export default function ProfileManager({
  className = "",
  user,
  onProfileUpdate,
  initialTab = 'overview'
}: ProfileManagerProps) {
  // State management
  const [activeTab, setActiveTab] = useState(initialTab);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [socialLinksForm, setSocialLinksForm] = useState<SocialLinks>({});
  const [preferencesForm, setPreferencesForm] = useState<UserPreferences>({});
  
  // UI states
  
  // Modal states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type?: 'unlinkAccount' | 'resetProfile';
    title?: string;
    message?: string;
    data?: any;
  }>({ isOpen: false });


  // Server actions
  const { execute: getProfile, status: getProfileStatus, result: profileResult } = useAction(getProfileAction);
  const { execute: updateSocialLinks, status: updateSocialLinksStatus } = useAction(updateSocialLinksAction);
  const { execute: updatePreferences } = useAction(updatePreferencesAction);
  const { execute: unlinkOAuthAccount, status: unlinkOAuthStatus } = useAction(unlinkOAuthAccountAction);
  const { execute: getStats, result: statsResult } = useAction(getProfileStatsAction);
  const { execute: getAuditLogs, status: auditLogsStatus, result: auditResult } = useAction(getUserAuditLogsAction);

  // Load profile data
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        // Load profile - next-safe-action doesn't return promises, it updates status
        getProfile();
        // Load stats
        getStats();
        // Load audit logs for activity tab
        getAuditLogs({ limit: 20 });
      } catch (error) {
        console.error('Failed to load profile data:', error);
      }
    };

    loadProfileData();
  }, [getProfile, getStats, getAuditLogs]);

  // Handle profile result
  useEffect(() => {
    if (profileResult?.data?.success) {
      const userProfile = UserProfile.fromJSON(profileResult.data.profile);
      setProfile(userProfile);
      
      // Initialize forms with profile data
      setSocialLinksForm(userProfile.socialLinks);
      setPreferencesForm(userProfile.preferences);
    }
  }, [profileResult]);

  // Handle stats result
  useEffect(() => {
    if (statsResult?.data?.success) {
      const stats = statsResult.data.stats as any;
      setProfileStats({
        completeness: stats.completeness || 0,
        linkedAccountsCount: stats.linkedAccountsCount || 0,
        age: stats.age || null,
        lastUpdated: stats.lastUpdated || undefined,
        recommendations: stats.recommendations || []
      });
    }
  }, [statsResult]);

  // Handle audit logs result
  useEffect(() => {
    if (auditResult?.data?.success) {
      setAuditLogs(auditResult.data.data);
    }
  }, [auditResult]);



  // Handle social links update
  const handleSocialLinksUpdate = useCallback(async () => {
    try {
      updateSocialLinks(socialLinksForm);
    } catch (error) {
      console.error('Failed to update social links:', error);
    }
  }, [socialLinksForm, updateSocialLinks]);


  // Calculate completion percentage for circular progress
  const completionPercentage = useMemo(() => {
    return profileStats?.completeness || 0;
  }, [profileStats]);

  // Get completion level and color
  const getCompletionLevel = useCallback((percentage: number) => {
    if (percentage >= 90) return { level: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-600' };
    if (percentage >= 70) return { level: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-600' };
    if (percentage >= 50) return { level: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-600' };
    return { level: 'Poor', color: 'text-red-600', bgColor: 'bg-red-600' };
  }, []);

  // Render Overview Tab
  const renderOverview = () => {
    const completion = getCompletionLevel(completionPercentage);
    
    return (
      <div className="space-y-6">
        {/* Profile Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
            {/* Avatar Section */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {profile?.avatarUrl || user?.image ? (
                  <Image
                    src={profile?.avatarUrl || user?.image || ''}
                    alt={user?.name || 'Profile'}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-gray-400">👤</span>
                )}
              </div>
              {/* Completion Ring */}
              <div className="absolute -top-1 -right-1">
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-300 dark:text-gray-600"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={completion.color}
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      strokeDasharray={`${completionPercentage}, 100`}
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {completionPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {user?.name || 'Anonymous User'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {user?.email}
              </p>
              {profile?.bio && (
                <p className="text-gray-700 dark:text-gray-300 mt-2">
                  {profile.bio}
                </p>
              )}
              
              {/* Quick Stats */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-4">
                <div className="text-center sm:text-left">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {completionPercentage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Complete
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {profileStats?.linkedAccountsCount || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Connected
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {profile?.getAge() || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Age
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                <button
                  onClick={() => setActiveTab('edit')}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => setActiveTab('avatar')}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Update Avatar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Completion */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Profile Completion
            </h3>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              completion.level === 'Excellent' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
              completion.level === 'Good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
              completion.level === 'Fair' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {completion.level}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Completion Progress</span>
                  <span>{completionPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${completion.bgColor}`}
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {profileStats?.recommendations && profileStats.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Recommendations to improve your profile:
                </h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {profileStats.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-indigo-500 mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Preview */}
        {auditLogs.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Recent Activity
              </h3>
              <button
                onClick={() => setActiveTab('activity')}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {auditLogs.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center space-x-3 py-2">
                  <div className={`w-2 h-2 rounded-full ${
                    event.success ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {event.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Edit Profile Tab
  const renderEditProfile = () => {
    if (!user || !profile) return null;

    return (
      <ProfileEditForm
        user={user}
        profile={profile}
        onUpdate={(updatedProfile) => {
          setProfile(updatedProfile);
          onProfileUpdate?.(AuthUser.fromJSON({ ...user, ...updatedProfile.toJSON() }));
        }}
        onCancel={() => setActiveTab('overview')}
        className=""
      />
    );
  };

  // Render Avatar Tab
  const renderAvatar = () => {
    if (!user) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Profile Picture
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload and customize your profile picture with our advanced cropping tool
            </p>
          </div>

          <AvatarUpload
            user={user}
            currentAvatar={profile?.avatarUrl || user?.image}
            onAvatarUpdate={(avatarUrl) => {
              // Update local profile state
              const updatedProfile = profile ? { ...profile, avatarUrl } : null;
              setProfile(updatedProfile as UserProfile);
              
              // Update parent component if needed
              onProfileUpdate?.(AuthUser.fromJSON({ ...user, image: avatarUrl }));
            }}
            onAvatarDelete={() => {
              // Update local profile state
              const updatedProfile = profile ? { ...profile, avatarUrl: undefined } : null;
              setProfile(updatedProfile as UserProfile);
              
              // Update parent component if needed
              onProfileUpdate?.(AuthUser.fromJSON({ ...user, image: undefined }));
            }}
            size="xl"
          />
        </div>
      </div>
    );
  };

  // Render Social Accounts Tab
  const renderSocialAccounts = () => {
    if (!user || !profile) return null;

    return (
      <div className="space-y-6">
        {/* OAuth Providers Section */}
        <SocialAccountsManager
          user={user}
          linkedAccounts={profile.linkedAccounts}
          onAccountLinked={(account) => {
            // Update profile with new linked account
            if (profile) {
              const updatedAccounts = [...profile.linkedAccounts];
              // Remove existing account for same provider
              const existingIndex = updatedAccounts.findIndex(acc => acc.provider === account.provider);
              if (existingIndex >= 0) {
                updatedAccounts[existingIndex] = account;
              } else {
                updatedAccounts.push(account);
              }
              
              setProfile({ ...profile, linkedAccounts: updatedAccounts } as UserProfile);
              
              // Refresh stats
              getStats();
            }
          }}
          onAccountUnlinked={(provider) => {
            // Update profile to remove unlinked account
            if (profile) {
              const updatedAccounts = profile.linkedAccounts.filter(acc => acc.provider !== provider);
              setProfile({ ...profile, linkedAccounts: updatedAccounts } as UserProfile);
              
              // Refresh stats
              getStats();
            }
          }}
        />

        {/* Social Media Links Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Social Media Links
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Add links to your social media profiles
              </p>
            </div>
            <button
              onClick={handleSocialLinksUpdate}
              disabled={updateSocialLinksStatus === 'executing'}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateSocialLinksStatus === 'executing' ? 'Saving...' : 'Save Links'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUPPORTED_SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform}>
                <label htmlFor={platform} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                  {platform === 'website' ? 'Personal Website' : platform}
                </label>
                <input
                  type="url"
                  id={platform}
                  value={socialLinksForm[platform] || ''}
                  onChange={(e) => setSocialLinksForm(prev => ({ ...prev, [platform]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={platform === 'website' ? 'https://yourwebsite.com' : `https://${platform}.com/yourusername`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render Preferences Tab
  const renderPreferences = () => {
    if (!user || !profile) return null;

    return (
      <AccountSettings
        user={user}
        preferences={preferencesForm}
        onPreferencesUpdate={(updatedPreferences) => {
          setPreferencesForm(updatedPreferences);
          // Auto-save preferences when updated from AccountSettings
          updatePreferences(updatedPreferences);
        }}
      />
    );
  };

  // Render Activity Tab
  const renderActivity = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Profile Activity
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last {auditLogs.length} events
          </div>
        </div>

        {auditLogsStatus === 'executing' ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-3 py-3">
                <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
                <div className="w-16 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        ) : auditLogs.length > 0 ? (
          <div className="space-y-3">
            {auditLogs.filter(event => 
              event.action.includes('profile') || 
              event.action.includes('avatar') || 
              event.action.includes('social') || 
              event.action.includes('preference')
            ).map((event) => (
              <div key={event.id} className="flex items-start space-x-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                  event.success ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{new Date(event.createdAt).toLocaleString()}</span>
                        {event.ipAddress && (
                          <>
                            <span>•</span>
                            <span>{event.ipAddress}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="capitalize">{event.eventType.toLowerCase()}</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                      event.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      event.severity === 'ERROR' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      event.severity === 'WARN' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {event.severity}
                    </div>
                  </div>
                  {event.userAgent && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                      {event.userAgent}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📊</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Profile Activity
            </h4>
            <p className="text-gray-500 dark:text-gray-400">
              Your profile activity will appear here as you make changes.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Handle confirm dialog actions
  const handleConfirmAction = useCallback(async () => {
    try {
      switch (confirmDialog.type) {
        case 'unlinkAccount':
          if (confirmDialog.data?.provider) {
            unlinkOAuthAccount({ provider: confirmDialog.data.provider });
            // Update profile to remove the linked account
            if (profile) {
              const updatedAccounts = profile.linkedAccounts.filter(
                acc => acc.provider !== confirmDialog.data.provider
              );
              setProfile({ ...profile, linkedAccounts: updatedAccounts } as UserProfile);
            }
          }
          break;
      }
      setConfirmDialog({ isOpen: false });
    } catch (error) {
      console.error('Confirm action failed:', error);
    }
  }, [confirmDialog.type, confirmDialog.data, unlinkOAuthAccount, profile]);

  if (getProfileStatus === 'executing') {
    return (
      <div className={`max-w-6xl mx-auto ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3 mb-8"></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Profile Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your personal information, preferences, and account connections
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                title={tab.description}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'edit' && renderEditProfile()}
          {activeTab === 'avatar' && renderAvatar()}
          {activeTab === 'social' && renderSocialAccounts()}
          {activeTab === 'preferences' && renderPreferences()}
          {activeTab === 'activity' && renderActivity()}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.title || ''}
        message={confirmDialog.message || ''}
        confirmText="Confirm"
        variant="danger"
        isLoading={
          confirmDialog.type === 'unlinkAccount' ? unlinkOAuthStatus === 'executing' : false
        }
      />
    </div>
  );
}