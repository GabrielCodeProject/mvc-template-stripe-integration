"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import { AuthUser } from "@/models/AuthUser";
import { UserPreferences } from "@/models/UserProfile";
import { updatePreferencesAction } from "@/actions/profile.actions";
import ConfirmDialog from "@/components/auth/shared/ConfirmDialog";

// Types and Interfaces
interface AccountSettingsProps {
  user: AuthUser;
  preferences: UserPreferences;
  onPreferencesUpdate?: (preferences: UserPreferences) => void;
  className?: string;
}

interface SettingSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  keywords: string[];
}


// Constants
const SETTING_SECTIONS: SettingSection[] = [
  {
    id: 'privacy',
    title: 'Privacy & Security',
    icon: '🔐',
    description: 'Control your profile visibility and data sharing',
    keywords: ['privacy', 'security', 'visibility', 'public', 'private', 'profile', 'email', 'location', 'search', 'indexing']
  },
  {
    id: 'notifications',
    title: 'Email & Notifications',
    icon: '📧',
    description: 'Manage email and push notification preferences',
    keywords: ['email', 'notifications', 'marketing', 'security', 'updates', 'newsletter', 'alerts', 'push', 'frequency']
  },
  {
    id: 'display',
    title: 'Display & Interface',
    icon: '🎨',
    description: 'Customize your interface experience',
    keywords: ['theme', 'dark', 'light', 'language', 'timezone', 'format', 'accessibility', 'contrast', 'text', 'motion']
  },
  {
    id: 'regional',
    title: 'Regional Settings',
    icon: '🌐',
    description: 'Set your location and formatting preferences',
    keywords: ['country', 'region', 'currency', 'language', 'format', 'units', 'distance', 'timezone', 'locale']
  },
  {
    id: 'account',
    title: 'Account Management',
    icon: '⚙️',
    description: 'Account security and data management',
    keywords: ['account', 'deactivate', 'delete', 'export', 'data', 'security', 'password', 'email', 'danger']
  }
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Spain', 
  'Italy', 'Netherlands', 'Australia', 'Japan', 'South Korea', 'China', 
  'Brazil', 'Mexico', 'Argentina', 'India', 'Other'
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Seoul', 'Asia/Kolkata',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
];

export default function AccountSettings({
  user,
  preferences: initialPreferences,
  onPreferencesUpdate,
  className = ""
}: AccountSettingsProps) {
  // State management
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['privacy']));
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Modal states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type?: 'deactivate' | 'delete' | 'export' | 'resetAll';
    title?: string;
    message?: string;
    data?: any;
  }>({ isOpen: false });

  // Server actions
  const { execute: updatePreferences, status: updateStatus } = useAction(updatePreferencesAction);

  // Save preferences
  const handleSavePreferences = useCallback(async () => {
    try {
      updatePreferences(preferences);
      onPreferencesUpdate?.(preferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }, [preferences, updatePreferences, onPreferencesUpdate]);

  // Handle preference updates
  const updatePreference = useCallback((path: string, value: unknown) => {
    setPreferences(prev => {
      const keys = path.split('.');
      const newPrefs = JSON.parse(JSON.stringify(prev));
      
      let current = newPrefs;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newPrefs;
    });
  }, []);

  // Track changes
  useEffect(() => {
    const hasChanges = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);
    setHasUnsavedChanges(hasChanges);
  }, [preferences, initialPreferences]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveEnabled && hasUnsavedChanges) {
      const autoSaveTimer = setTimeout(() => {
        handleSavePreferences();
      }, 2000);

      return () => clearTimeout(autoSaveTimer);
    }
  }, [preferences, hasUnsavedChanges, autoSaveEnabled, handleSavePreferences]);

  // Reset to defaults
  const handleResetToDefaults = useCallback(() => {
    setConfirmDialog({
      isOpen: true,
      type: 'resetAll',
      title: 'Reset All Settings',
      message: 'This will reset all your preferences to their default values. This action cannot be undone.',
    });
  }, []);

  // Filter settings based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery) return SETTING_SECTIONS;

    const query = searchQuery.toLowerCase();
    return SETTING_SECTIONS.filter(section =>
      section.title.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query) ||
      section.keywords.some(keyword => keyword.includes(query))
    );
  }, [searchQuery]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Privacy & Security Section
  const renderPrivacySection = () => (
    <div className="space-y-6">
      {/* Profile Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Profile Visibility
        </label>
        <div className="space-y-3">
          {[
            { value: 'public', label: 'Public', desc: 'Anyone can see your profile' },
            { value: 'friends', label: 'Friends Only', desc: 'Only connected accounts can see your profile' },
            { value: 'private', label: 'Private', desc: 'Only you can see your profile' }
          ].map((option) => (
            <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="profileVisibility"
                value={option.value}
                checked={preferences.privacySettings?.profileVisibility === option.value}
                onChange={(e) => updatePreference('privacySettings.profileVisibility', e.target.value)}
                className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {option.desc}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Information Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
          Show in Profile
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'showEmail', label: 'Email Address', desc: 'Display your email publicly' },
            { key: 'showLocation', label: 'Location', desc: 'Show your location information' },
            { key: 'showSocialLinks', label: 'Social Links', desc: 'Display connected social accounts' },
            { key: 'showActivityStatus', label: 'Activity Status', desc: 'Show online/offline status' }
          ].map((setting) => (
            <label key={setting.key} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(preferences.privacySettings?.[setting.key as keyof typeof preferences.privacySettings])}
                onChange={(e) => updatePreference(`privacySettings.${setting.key}`, e.target.checked)}
                className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {setting.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {setting.desc}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Search Engine Indexing */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!preferences.privacySettings?.searchEngineIndexing}
            onChange={(e) => updatePreference('privacySettings.searchEngineIndexing', !e.target.checked)}
            className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Prevent Search Engine Indexing
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              When enabled, search engines will be asked not to index your public profile
            </div>
          </div>
        </label>
      </div>
    </div>
  );

  // Email & Notifications Section
  const renderNotificationsSection = () => (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
          Email Notifications
        </label>
        <div className="space-y-4">
          {[
            { 
              key: 'security', 
              label: 'Security Alerts', 
              desc: 'Login attempts, password changes, and other security events',
              locked: true,
              icon: '🔒'
            },
            { 
              key: 'updates', 
              label: 'Product Updates', 
              desc: 'New features, improvements, and platform changes',
              icon: '🚀'
            },
            { 
              key: 'digest', 
              label: 'Weekly Digest', 
              desc: 'Summary of your account activity and recommendations',
              icon: '📊'
            },
            { 
              key: 'marketing', 
              label: 'Marketing Communications', 
              desc: 'Promotional emails, special offers, and product announcements',
              icon: '📢'
            },
          ].map((notification) => (
            <div key={notification.key} className="flex items-start space-x-3">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  disabled={notification.locked}
                  checked={notification.locked || Boolean(preferences.emailNotifications?.[notification.key as keyof typeof preferences.emailNotifications])}
                  onChange={(e) => updatePreference(`emailNotifications.${notification.key}`, e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {notification.icon} {notification.label}
                  </span>
                  {notification.locked && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-400">
                      Always enabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {notification.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Frequency */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Email Frequency
        </label>
        <select
          value={preferences.emailNotifications?.frequency || 'instant'}
          onChange={(e) => updatePreference('emailNotifications.frequency', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="instant">Instant - Send immediately</option>
          <option value="hourly">Hourly - Batch notifications</option>
          <option value="daily">Daily - Once per day digest</option>
          <option value="weekly">Weekly - Weekly summary</option>
          <option value="never">Never - No email notifications</option>
        </select>
      </div>

      {/* Push Notifications */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            🔔 Push Notifications
          </h4>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={Boolean(preferences.pushNotifications?.enabled)}
              onChange={(e) => updatePreference('pushNotifications.enabled', e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable</span>
          </label>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Receive real-time notifications in your browser or mobile device
        </p>
      </div>
    </div>
  );

  // Display & Interface Section
  const renderDisplaySection = () => (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Theme Preference
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'system', label: 'System', icon: '💻', desc: 'Use system setting' },
            { value: 'light', label: 'Light', icon: '☀️', desc: 'Always light theme' },
            { value: 'dark', label: 'Dark', icon: '🌙', desc: 'Always dark theme' }
          ].map((theme) => (
            <label key={theme.value} className="cursor-pointer">
              <input
                type="radio"
                name="theme"
                value={theme.value}
                checked={preferences.theme === theme.value}
                onChange={(e) => updatePreference('theme', e.target.value)}
                className="sr-only"
              />
              <div className={`p-3 border-2 rounded-lg text-center transition-all ${
                preferences.theme === theme.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}>
                <div className="text-2xl mb-1">{theme.icon}</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{theme.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{theme.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Language Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Language
        </label>
        <select
          value={preferences.language || 'en'}
          onChange={(e) => updatePreference('language', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date & Time Format */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Time Format
          </label>
          <select
            value={preferences.displaySettings?.timeFormat || '12h'}
            onChange={(e) => updatePreference('displaySettings.timeFormat', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="12h">12 Hour (2:30 PM)</option>
            <option value="24h">24 Hour (14:30)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Date Format
          </label>
          <select
            value={preferences.displaySettings?.dateFormat || 'MM/DD/YYYY'}
            onChange={(e) => updatePreference('displaySettings.dateFormat', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
        </div>
      </div>

      {/* Accessibility Options */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
          ♿ Accessibility Options
        </h4>
        <div className="space-y-3">
          {[
            { key: 'highContrast', label: 'High Contrast Mode', desc: 'Increase contrast for better visibility' },
            { key: 'largeText', label: 'Large Text', desc: 'Increase font sizes throughout the interface' },
            { key: 'reducedMotion', label: 'Reduce Motion', desc: 'Minimize animations and transitions' }
          ].map((option) => (
            <label key={option.key} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(preferences.accessibilitySettings?.[option.key as keyof typeof preferences.accessibilitySettings])}
                onChange={(e) => updatePreference(`accessibilitySettings.${option.key}`, e.target.checked)}
                className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {option.desc}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // Regional Settings Section
  const renderRegionalSection = () => (
    <div className="space-y-6">
      {/* Country/Region */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Country/Region
        </label>
        <select
          value={preferences.regionalSettings?.country || ''}
          onChange={(e) => updatePreference('regionalSettings.country', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Select your country</option>
          {COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Timezone
        </label>
        <select
          value={preferences.timezone || ''}
          onChange={(e) => updatePreference('timezone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Auto-detect timezone</option>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Currency & Units */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Currency
          </label>
          <select
            value={preferences.displaySettings?.currency || 'USD'}
            onChange={(e) => updatePreference('displaySettings.currency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Distance Units
          </label>
          <select
            value={preferences.regionalSettings?.distanceUnit || 'miles'}
            onChange={(e) => updatePreference('regionalSettings.distanceUnit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="miles">Miles</option>
            <option value="kilometers">Kilometers</option>
          </select>
        </div>
      </div>

      {/* Number Format */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Number Format
        </label>
        <select
          value={preferences.regionalSettings?.numberFormat || 'us'}
          onChange={(e) => updatePreference('regionalSettings.numberFormat', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="us">US Format (1,234.56)</option>
          <option value="eu">European Format (1.234,56)</option>
          <option value="space">Space Format (1 234,56)</option>
        </select>
      </div>
    </div>
  );

  // Account Management Section
  const renderAccountSection = () => (
    <div className="space-y-6">
      {/* Email Change */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            📧 Email Address
          </h4>
          <button
            onClick={() => {
              // In a real implementation, this would open email change flow
              console.log('Email change requested');
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
          >
            Change
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Current: {user.email}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Changing your email requires verification and may affect your login
        </p>
      </div>

      {/* Data Export */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            📦 Export Your Data
          </h4>
          <button
            onClick={() => setConfirmDialog({
              isOpen: true,
              type: 'export',
              title: 'Export Account Data',
              message: 'We will prepare a download of all your account data and send it to your email address. This may take a few minutes to process.',
            })}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
          >
            Request Export
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Download a copy of all your account data including profile information, preferences, and activity logs
        </p>
      </div>

      {/* Dangerous Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-4">
          ⚠️ Danger Zone
        </h4>
        
        <div className="space-y-4">
          {/* Account Deactivation */}
          <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-red-900 dark:text-red-100">
                Deactivate Account
              </h5>
              <button
                onClick={() => setConfirmDialog({
                  isOpen: true,
                  type: 'deactivate',
                  title: 'Deactivate Account',
                  message: 'Your account will be temporarily disabled. You can reactivate it by logging in again. Your data will be preserved.',
                })}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
              >
                Deactivate
              </button>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300">
              Temporarily disable your account. You can reactivate it anytime by logging in.
            </p>
          </div>

          {/* Account Deletion */}
          <div className="p-4 border border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-red-900 dark:text-red-100">
                Delete Account
              </h5>
              <button
                onClick={() => setConfirmDialog({
                  isOpen: true,
                  type: 'delete',
                  title: 'Delete Account Permanently',
                  message: 'This will permanently delete your account and all associated data. This action cannot be undone. You will need to confirm this action via email.',
                })}
                className="text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 text-sm font-medium"
              >
                Delete Forever
              </button>
            </div>
            <p className="text-xs text-red-800 dark:text-red-200">
              Permanently delete your account and all data. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Handle confirm actions
  const handleConfirmAction = useCallback(async () => {
    try {
      switch (confirmDialog.type) {
        case 'export':
          console.log('Data export requested');
          // In a real implementation, this would trigger data export
          break;
        case 'deactivate':
          console.log('Account deactivation requested');
          // In a real implementation, this would deactivate the account
          break;
        case 'delete':
          console.log('Account deletion requested');
          // In a real implementation, this would start account deletion process
          break;
        case 'resetAll':
          setPreferences({});
          break;
      }
      setConfirmDialog({ isOpen: false });
    } catch (error) {
      console.error('Confirm action failed:', error);
    }
  }, [confirmDialog.type]);

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header with Search and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Account Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your preferences, privacy, and account security
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Auto-save toggle */}
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"
            />
            <span className="text-gray-700 dark:text-gray-300">Auto-save</span>
          </label>

          {/* Manual save button */}
          {!autoSaveEnabled && hasUnsavedChanges && (
            <button
              onClick={handleSavePreferences}
              disabled={updateStatus === 'executing'}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {updateStatus === 'executing' ? 'Saving...' : 'Save Changes'}
            </button>
          )}

          {/* Reset button */}
          <button
            onClick={handleResetToDefaults}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400">🔍</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Unsaved Changes Indicator */}
      {hasUnsavedChanges && !autoSaveEnabled && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              You have unsaved changes
            </span>
          </div>
          <button
            onClick={handleSavePreferences}
            disabled={updateStatus === 'executing'}
            className="text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 text-sm font-medium"
          >
            Save now
          </button>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => (
          <div
            key={section.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{section.icon}</span>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {section.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {section.description}
                  </p>
                </div>
              </div>
              <span className={`transform transition-transform ${
                expandedSections.has(section.id) ? 'rotate-180' : ''
              }`}>
                ▼
              </span>
            </button>

            {expandedSections.has(section.id) && (
              <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
                <div className="pt-4">
                  {section.id === 'privacy' && renderPrivacySection()}
                  {section.id === 'notifications' && renderNotificationsSection()}
                  {section.id === 'display' && renderDisplaySection()}
                  {section.id === 'regional' && renderRegionalSection()}
                  {section.id === 'account' && renderAccountSection()}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredSections.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No settings found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your search terms or browse all sections above.
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.title || ''}
        message={confirmDialog.message || ''}
        confirmText={confirmDialog.type === 'delete' ? 'Delete Forever' : 'Confirm'}
        variant={confirmDialog.type === 'delete' || confirmDialog.type === 'deactivate' ? 'danger' : 'info'}
        isLoading={updateStatus === 'executing'}
      />
    </div>
  );
}