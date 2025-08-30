"use client";

import { useEffect, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { getUserSessionsAction, revokeSessionAction, revokeAllOtherSessionsAction } from "@/actions/auth.actions";
import ConfirmDialog from "./ConfirmDialog";

interface SessionData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  isCurrent: boolean;
  timeRemaining?: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
  };
  deviceDisplayName: string;
  locationInfo: {
    ip?: string;
    displayLocation: string;
  };
  lastActiveFormatted: string;
  deviceIcon: string;
}

interface SessionListProps {
  onSessionRevoked?: (sessionId: string) => void;
  className?: string;
}

export default function SessionList({ onSessionRevoked, className = "" }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    sessionId?: string;
    deviceName?: string;
    type?: "single" | "all";
  }>({
    isOpen: false,
  });

  // Actions
  const {
    execute: loadSessions,
    status: loadStatus,
    result: loadResult,
  } = useAction(getUserSessionsAction);

  const {
    execute: revokeSession,
    status: revokeStatus,
  } = useAction(revokeSessionAction);

  const {
    execute: revokeAllOther,
    status: revokeAllStatus,
  } = useAction(revokeAllOtherSessionsAction);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Update sessions when load result changes
  useEffect(() => {
    if (loadResult?.data?.success && loadResult.data.sessions) {
      setSessions(loadResult.data.sessions);
    }
  }, [loadResult]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession({ sessionId });
      // Remove the revoked session from the list
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      onSessionRevoked?.(sessionId);
      
      // Close confirmation dialog
      setConfirmDialog({ isOpen: false });
    } catch (error) {
      console.error('Failed to revoke session:', error);
    }
  };

  const handleRevokeAllOther = async () => {
    try {
      await revokeAllOther();
      // Keep only the current session
      setSessions(prev => prev.filter(s => s.isCurrent));
      
      // Close confirmation dialog
      setConfirmDialog({ isOpen: false });
    } catch (error) {
      console.error('Failed to revoke all other sessions:', error);
    }
  };

  const openConfirmDialog = (sessionId: string, deviceName: string) => {
    setConfirmDialog({
      isOpen: true,
      sessionId,
      deviceName,
      type: "single",
    });
  };

  const openRevokeAllDialog = () => {
    setConfirmDialog({
      isOpen: true,
      type: "all",
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ isOpen: false });
  };

  const handleConfirm = () => {
    if (confirmDialog.type === "single" && confirmDialog.sessionId) {
      handleRevokeSession(confirmDialog.sessionId);
    } else if (confirmDialog.type === "all") {
      handleRevokeAllOther();
    }
  };

  const isLoading = loadStatus === "executing";
  const isRevoking = revokeStatus === "executing" || revokeAllStatus === "executing";
  const otherSessions = sessions.filter(s => !s.isCurrent);

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Active Sessions
          </h3>
        </div>
        
        {/* Loading skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
                <div className="w-20 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No Active Sessions
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have any active sessions at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Active Sessions
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your active sessions across different devices
          </p>
        </div>
        
        {otherSessions.length > 0 && (
          <button
            onClick={openRevokeAllDialog}
            disabled={isRevoking}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Revoke All Other Sessions
          </button>
        )}
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`bg-white dark:bg-gray-800 rounded-lg border p-4 transition-colors ${
              session.isCurrent
                ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-start space-x-4">
              {/* Device Icon */}
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  session.isCurrent
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}>
                  {session.deviceIcon}
                </div>
              </div>

              {/* Session Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.deviceDisplayName}
                  </h4>
                  {session.isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Current Session
                    </span>
                  )}
                </div>
                
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0">
                    <span>{session.locationInfo.displayLocation}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Last active {session.lastActiveFormatted}</span>
                  </div>
                  
                  {session.timeRemaining && (
                    <div className="flex items-center space-x-1">
                      <span>Expires in {session.timeRemaining}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0">
                {!session.isCurrent && (
                  <button
                    onClick={() => openConfirmDialog(session.id, session.deviceDisplayName)}
                    disabled={isRevoking}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      {sessions.length > 1 && (
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You have {sessions.length} active session{sessions.length !== 1 ? 's' : ''} across your devices
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={handleConfirm}
        title={
          confirmDialog.type === "single"
            ? "Revoke Session"
            : "Revoke All Other Sessions"
        }
        message={
          confirmDialog.type === "single"
            ? `Are you sure you want to revoke the session on "${confirmDialog.deviceName}"? This will log you out of that device.`
            : `Are you sure you want to revoke all other sessions? This will log you out of all devices except this one.`
        }
        confirmText="Revoke"
        variant="warning"
        isLoading={isRevoking}
      />
    </div>
  );
}