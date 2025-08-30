"use client";

import { useState, useEffect } from "react";
import { useAction } from "next-safe-action/hooks";
import { AuthUser } from "@/models/AuthUser";
import SessionList from "@/components/auth/shared/SessionList";
import TwoFactorSetup from "@/components/auth/shared/TwoFactorSetup";
import ConfirmDialog from "@/components/auth/shared/ConfirmDialog";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import { 
  disable2FAAction, 
  generate2FABackupCodesAction,
  changePasswordAction,
  revokeAllOtherSessionsAction 
} from "@/actions/auth.actions";
import { 
  getUserAuditLogsAction,
  getAuditStatsAction 
} from "@/actions/security-audit.actions";

// Types
interface SecuritySettingsProps {
  className?: string;
  user?: AuthUser;
  onSecurityChange?: (event: SecurityChangeEvent) => void;
}

interface SecurityChangeEvent {
  type: 'password_changed' | '2fa_enabled' | '2fa_disabled' | 'sessions_revoked' | 'backup_codes_generated';
  data?: unknown;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  action: string;
  success: boolean;
  severity: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  eventData?: Record<string, unknown>;
}

interface SecurityScore {
  score: number;
  maxScore: number;
  level: 'low' | 'medium' | 'high' | 'excellent';
  recommendations: string[];
}

// Tab definitions
const SECURITY_TABS = [
  { id: 'overview', name: 'Security Overview', icon: '🛡️' },
  { id: 'password', name: 'Password Security', icon: '🔐' },
  { id: 'twofactor', name: 'Two-Factor Auth', icon: '📱' },
  { id: 'sessions', name: 'Active Sessions', icon: '💻' },
  { id: 'activity', name: 'Security Activity', icon: '📊' },
  { id: 'emergency', name: 'Emergency Actions', icon: '🚨' },
];

export default function SecuritySettings({ 
  className = "",
  user,
  onSecurityChange 
}: SecuritySettingsProps) {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [auditLogs, setAuditLogs] = useState<SecurityEvent[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  
  // Modal states
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type?: 'disable2fa' | 'revoke_sessions' | 'reset_security';
    title?: string;
    message?: string;
  }>({ isOpen: false });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Server actions
  const { execute: disable2FA, status: disable2FAStatus } = useAction(disable2FAAction);
  const { execute: generateBackupCodes, status: backupCodesStatus } = useAction(generate2FABackupCodesAction);
  const { execute: changePassword, status: changePasswordStatus } = useAction(changePasswordAction);
  const { execute: revokeAllSessions, status: revokeSessionsStatus } = useAction(revokeAllOtherSessionsAction);
  const { execute: loadAuditLogs, status: auditLogsStatus } = useAction(getUserAuditLogsAction);
  const { execute: loadAuditStats } = useAction(getAuditStatsAction);

  // Load security data
  useEffect(() => {
    const loadSecurityData = async () => {
      try {
        // Load audit logs
        const auditResult = await loadAuditLogs({ limit: 10 }) as any;
        if (auditResult?.success) {
          setAuditLogs(auditResult.data);
        }

        // Load security stats (if user has admin permissions)
        if (user?.role === 'ADMIN' || user?.role === 'SUPPORT') {
          await loadAuditStats({});
          // Note: Stats would be handled in a real implementation
        }
      } catch (error) {
        console.error('Failed to load security data:', error);
      }
    };

    loadSecurityData();
  }, [loadAuditLogs, loadAuditStats, user]);

  // Calculate security score
  useEffect(() => {
    if (!user) return;

    const calculateSecurityScore = (): SecurityScore => {
      let score = 0;
      const maxScore = 100;
      const recommendations: string[] = [];

      // 2FA enabled (40 points)
      if (user.twoFactorEnabled) {
        score += 40;
      } else {
        recommendations.push("Enable two-factor authentication for enhanced security");
      }

      // Email verified (20 points)
      if (user.emailVerified) {
        score += 20;
      } else {
        recommendations.push("Verify your email address");
      }

      // Account age (10 points if > 30 days)
      if (user.createdAt && new Date().getTime() - new Date(user.createdAt).getTime() > 30 * 24 * 60 * 60 * 1000) {
        score += 10;
      }

      // Recent login activity (10 points)
      if (user.lastLoginAt && new Date().getTime() - new Date(user.lastLoginAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
        score += 10;
      }

      // Strong password (assumed based on recent changes) (20 points)
      // This would need to be tracked in user profile
      score += 20; // Assume strong password for now

      let level: SecurityScore['level'] = 'low';
      if (score >= 90) level = 'excellent';
      else if (score >= 70) level = 'high';
      else if (score >= 50) level = 'medium';

      return { score, maxScore, level, recommendations };
    };

    setSecurityScore(calculateSecurityScore());
  }, [user]);

  // Handle password form submission
  const handlePasswordSubmit = async () => {
    const errors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    }

    setPasswordErrors(errors);

    if (Object.keys(errors).length > 0) return;

    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      }) as any;

      if (result?.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        onSecurityChange?.({ type: 'password_changed' });
      }
    } catch {
      setPasswordErrors({ general: 'Failed to change password. Please try again.' });
    }
  };

  // Handle 2FA disable
  const handleDisable2FA = async () => {
    try {
      const result = await disable2FA({ password: passwordForm.currentPassword }) as any;
      if (result?.success) {
        setConfirmDialog({ isOpen: false });
        onSecurityChange?.({ type: '2fa_disabled' });
      }
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
    }
  };

  // Handle backup codes generation
  const handleGenerateBackupCodes = async () => {
    try {
      const result = await generateBackupCodes({ password: passwordForm.currentPassword }) as any;
      if (result?.success) {
        onSecurityChange?.({ type: 'backup_codes_generated', data: result.backupCodes });
      }
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
    }
  };

  // Handle session revocation
  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessions();
      setConfirmDialog({ isOpen: false });
      onSecurityChange?.({ type: 'sessions_revoked' });
    } catch (error) {
      console.error('Failed to revoke sessions:', error);
    }
  };

  // Render security overview cards
  const renderSecurityOverview = () => (
    <div className="space-y-6">
      {/* Security Score Card */}
      {securityScore && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Security Score
            </h3>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              securityScore.level === 'excellent' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
              securityScore.level === 'high' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
              securityScore.level === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {securityScore.level.charAt(0).toUpperCase() + securityScore.level.slice(1)}
            </div>
          </div>

          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Security Score</span>
                <span>{securityScore.score}/{securityScore.maxScore}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    securityScore.level === 'excellent' ? 'bg-green-600' :
                    securityScore.level === 'high' ? 'bg-blue-600' :
                    securityScore.level === 'medium' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ width: `${(securityScore.score / securityScore.maxScore) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {securityScore.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Recommendations:
              </h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {securityScore.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 2FA Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              user?.twoFactorEnabled 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              <span className="text-lg">
                {user?.twoFactorEnabled ? '🔐' : '🔓'}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Two-Factor Auth
              </h4>
              <p className={`text-xs ${
                user?.twoFactorEnabled 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Email Verification */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              user?.emailVerified 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              <span className="text-lg">
                {user?.emailVerified ? '✅' : '⚠️'}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Email Status
              </h4>
              <p className={`text-xs ${
                user?.emailVerified 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {user?.emailVerified ? 'Verified' : 'Unverified'}
              </p>
            </div>
          </div>
        </div>

        {/* Last Login */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-lg">🕐</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Last Login
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {user?.lastLoginAt 
                  ? new Date(user.lastLoginAt).toLocaleDateString()
                  : 'Never'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Account Age */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <span className="text-lg">📅</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Member Since
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {user?.createdAt 
                  ? new Date(user.createdAt).toLocaleDateString()
                  : 'Unknown'
                }
              </p>
            </div>
          </div>
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
                    {event.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  event.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  event.severity === 'ERROR' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                  event.severity === 'WARN' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>
                  {event.severity}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render password security section
  const renderPasswordSecurity = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Password Security
          </h3>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Change Password
          </button>
        </div>

        {showPasswordForm && (
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="Enter your current password"
              />
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.currentPassword}</p>
              )}
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="new-password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="Enter your new password"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.newPassword}</p>
              )}
              {passwordForm.newPassword && (
                <div className="mt-2">
                  <PasswordStrengthIndicator
                    password={passwordForm.newPassword}
                    showRequirements
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirm-password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="Confirm your new password"
              />
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.confirmPassword}</p>
              )}
            </div>

            {passwordErrors.general && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-300">{passwordErrors.general}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordErrors({});
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={changePasswordStatus === 'executing'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changePasswordStatus === 'executing' ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        )}

        {/* Password Requirements */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Password Requirements
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• At least 8 characters long</li>
            <li>• Contains uppercase and lowercase letters</li>
            <li>• Includes at least one number</li>
            <li>• Uses special characters (!@#$%^&*)</li>
            <li>• Different from your current password</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // Render two-factor authentication section
  const renderTwoFactorAuth = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Two-Factor Authentication
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Add an extra layer of security to your account
            </p>
          </div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            user?.twoFactorEnabled 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {user?.twoFactorEnabled ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start space-x-3">
                <span className="text-green-600 dark:text-green-400 text-lg">✅</span>
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">
                    Two-Factor Authentication is enabled
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                    Your account is protected with an additional security layer. You&apos;ll need your authenticator app code when logging in.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleGenerateBackupCodes}
                disabled={backupCodesStatus === 'executing'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {backupCodesStatus === 'executing' ? 'Generating...' : 'Generate New Backup Codes'}
              </button>
              <button
                onClick={() => setConfirmDialog({
                  isOpen: true,
                  type: 'disable2fa',
                  title: 'Disable Two-Factor Authentication',
                  message: 'Are you sure you want to disable two-factor authentication? This will make your account less secure. You will need to enter your password to confirm.'
                })}
                disabled={disable2FAStatus === 'executing'}
                className="px-4 py-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start space-x-3">
                <span className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    Two-Factor Authentication is disabled
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                    Your account is vulnerable to unauthorized access. Enable 2FA to add an extra layer of protection.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShow2FASetup(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium"
            >
              Enable Two-Factor Authentication
            </button>
          </div>
        )}
      </div>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <TwoFactorSetup
              onSetupComplete={(updatedUser) => {
                setShow2FASetup(false);
                onSecurityChange?.({ type: '2fa_enabled', data: updatedUser });
              }}
              onCancel={() => setShow2FASetup(false)}
            />
          </div>
        </div>
      )}
    </div>
  );

  // Render active sessions section
  const renderActiveSessions = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <SessionList
          onSessionRevoked={(sessionId) => {
            onSecurityChange?.({ type: 'sessions_revoked', data: { sessionId } });
          }}
        />
      </div>
    </div>
  );

  // Render security activity section
  const renderSecurityActivity = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Security Activity
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
            {auditLogs.map((event) => (
              <div key={event.id} className="flex items-start space-x-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                  event.success ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
              No Security Activity
            </h4>
            <p className="text-gray-500 dark:text-gray-400">
              Your security activity will appear here as you use the application.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Render emergency actions section
  const renderEmergencyActions = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Emergency Actions
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Use these actions in case of security concerns or compromised access
          </p>
        </div>

        <div className="space-y-4">
          {/* Revoke All Sessions */}
          <div className="border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-orange-600 dark:text-orange-400 text-lg">🚨</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Logout from All Devices
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  This will end all active sessions on all devices. You&apos;ll need to log in again on all devices.
                </p>
                <button
                  onClick={() => setConfirmDialog({
                    isOpen: true,
                    type: 'revoke_sessions',
                    title: 'Logout from All Devices',
                    message: 'Are you sure you want to logout from all devices? You will need to log in again on all your devices, including this one.'
                  })}
                  disabled={revokeSessionsStatus === 'executing'}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {revokeSessionsStatus === 'executing' ? 'Logging out...' : 'Logout All Devices'}
                </button>
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Account Security Information
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Download a summary of your account security settings and recent activity.
                </p>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                  onClick={() => {
                    // This would trigger a download of security information
                    const securityInfo = {
                      user: {
                        id: user?.id,
                        email: user?.email,
                        twoFactorEnabled: user?.twoFactorEnabled,
                        emailVerified: user?.emailVerified,
                        createdAt: user?.createdAt,
                        lastLoginAt: user?.lastLoginAt,
                      },
                      securityScore,
                      recentActivity: auditLogs.slice(0, 10),
                      exportedAt: new Date().toISOString(),
                    };

                    const blob = new Blob([JSON.stringify(securityInfo, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'security-information.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Security Info
                </button>
              </div>
            </div>
          </div>

          {/* Contact Support */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-gray-600 dark:text-gray-400 text-lg">💬</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Contact Security Support
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  If you suspect unauthorized access or need help with security issues, contact our security team.
                </p>
                <a
                  href="mailto:security@yourcompany.com"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Security Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account security, authentication, and privacy settings
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {SECURITY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && renderSecurityOverview()}
          {activeTab === 'password' && renderPasswordSecurity()}
          {activeTab === 'twofactor' && renderTwoFactorAuth()}
          {activeTab === 'sessions' && renderActiveSessions()}
          {activeTab === 'activity' && renderSecurityActivity()}
          {activeTab === 'emergency' && renderEmergencyActions()}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false })}
        onConfirm={() => {
          if (confirmDialog.type === 'disable2fa') {
            handleDisable2FA();
          } else if (confirmDialog.type === 'revoke_sessions') {
            handleRevokeAllSessions();
          }
        }}
        title={confirmDialog.title || ''}
        message={confirmDialog.message || ''}
        confirmText={confirmDialog.type === 'disable2fa' ? 'Disable 2FA' : 'Confirm'}
        variant={confirmDialog.type === 'disable2fa' ? 'danger' : 'warning'}
        isLoading={
          confirmDialog.type === 'disable2fa' ? disable2FAStatus === 'executing' :
          confirmDialog.type === 'revoke_sessions' ? revokeSessionsStatus === 'executing' :
          false
        }
      />
    </div>
  );
}