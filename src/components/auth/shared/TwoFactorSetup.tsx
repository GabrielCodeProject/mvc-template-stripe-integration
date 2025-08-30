"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import Image from "next/image";
import { setup2FAAction, verify2FASetupAction } from "@/actions/auth.actions";
import { AuthUser } from "@/models/AuthUser";

// Types
interface TwoFactorSetupProps {
  onSetupComplete?: (user: AuthUser) => void;
  onCancel?: () => void;
  className?: string;
}

interface SetupState {
  step: number;
  secret: string;
  qrCodeImage: string;
  manualEntryKey: string;
  backupCodes: string[];
  isLoading: boolean;
  error: string | null;
}

// Step component types
interface StepProps {
  onNext: () => void;
  onPrev?: () => void;
  onCancel: () => void;
  setupState: SetupState;
  setSetupState: React.Dispatch<React.SetStateAction<SetupState>>;
}

// Constants
const TOTAL_STEPS = 5;
const STEP_NAMES = [
  "Introduction",
  "QR Code Setup",
  "Verification",
  "Backup Codes",
  "Completion"
];

// Utility function to format backup codes for display
const formatBackupCodes = (codes: string[]): string[][] => {
  const formatted: string[][] = [];
  for (let i = 0; i < codes.length; i += 2) {
    formatted.push(codes.slice(i, i + 2));
  }
  return formatted;
};

// Utility function to download backup codes as text file
const downloadBackupCodes = (codes: string[]) => {
  const content = `Two-Factor Authentication Backup Codes

IMPORTANT: Keep these backup codes in a safe place. Each code can only be used once.

${codes.map((code, index) => `${(index + 1).toString().padStart(2, '0')}. ${code}`).join('\n')}

Generated on: ${new Date().toLocaleString()}

Instructions:
- Use these codes if you lose access to your authenticator app
- Each code can only be used once
- Keep them secure and don't share them with anyone
- Generate new codes if you suspect they've been compromised
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = '2fa-backup-codes.txt';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

// Copy backup codes to clipboard
const copyBackupCodes = async (codes: string[]): Promise<boolean> => {
  try {
    const text = codes.join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy backup codes:', error);
    return false;
  }
};

// Progress Indicator Component
interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
}

const ProgressIndicator = ({ currentStep, totalSteps, stepNames }: ProgressIndicatorProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          
          return (
            <div key={stepNumber} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {isCompleted ? "✓" : stepNumber}
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    stepNumber < currentStep
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="text-center">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Step {currentStep} of {totalSteps}: {stepNames[currentStep - 1]}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Step 1: Introduction Component
const IntroductionStep = ({ onNext, onCancel }: StepProps) => {
  return (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-4">🔐</div>
      
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Set Up Two-Factor Authentication
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Add an extra layer of security to your account with two-factor authentication (2FA).
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">What you&apos;ll need:</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 text-left">
          <li>• An authenticator app (Google Authenticator, Authy, Microsoft Authenticator)</li>
          <li>• Your mobile device or computer with the authenticator app installed</li>
          <li>• A few minutes to complete the setup process</li>
        </ul>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-start space-x-3">
          <div className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</div>
          <div className="text-left">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">Important:</h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Make sure to save your backup codes in a secure location. You&apos;ll need them if you lose access to your authenticator device.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-4 justify-center pt-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

// Step 2: QR Code Display Component
const QRCodeStep = ({ onNext, onPrev, onCancel, setupState, setSetupState }: StepProps) => {
  const [showManualEntry, setShowManualEntry] = useState(false);
  
  const {
    execute: setup2FA,
    status: setupStatus,
  } = useAction(setup2FAAction);

  useEffect(() => {
    const initializeSetup = async () => {
      if (!setupState.secret) {
        setSetupState(prev => ({ ...prev, isLoading: true, error: null }));
        
        try {
          const result = await setup2FA() as any;
          
          if (result?.success) {
            setSetupState(prev => ({
              ...prev,
              secret: result.secret,
              qrCodeImage: result.qrCodeImage,
              manualEntryKey: result.manualEntryKey,
              backupCodes: result.backupCodes,
              isLoading: false,
            }));
          } else {
            setSetupState(prev => ({
              ...prev,
              error: "Failed to initialize 2FA setup. Please try again.",
              isLoading: false,
            }));
          }
        } catch {
          setSetupState(prev => ({
            ...prev,
            error: "An unexpected error occurred. Please try again.",
            isLoading: false,
          }));
        }
      }
    };

    initializeSetup();
  }, [setup2FA, setupState.secret, setSetupState]);

  if (setupState.isLoading || setupStatus === "executing") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400">Setting up your 2FA...</p>
      </div>
    );
  }

  if (setupState.error) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl mb-4">❌</div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300">{setupState.error}</p>
        </div>
        <div className="flex space-x-4 justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setSetupState(prev => ({ ...prev, error: null, secret: "" }));
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Scan QR Code
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Use your authenticator app to scan this QR code
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 inline-block">
        {setupState.qrCodeImage ? (
          <Image
            src={setupState.qrCodeImage}
            alt="2FA QR Code"
            width={256}
            height={256}
            className="w-64 h-64 mx-auto"
            priority
          />
        ) : (
          <div className="w-64 h-64 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <p className="text-gray-500">Loading QR Code...</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
            Recommended Authenticator Apps:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-blue-800 dark:text-blue-300">
            <div>📱 Google Authenticator</div>
            <div>🔐 Authy</div>
            <div>🔵 Microsoft Authenticator</div>
          </div>
        </div>

        <button
          onClick={() => setShowManualEntry(!showManualEntry)}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm underline"
        >
          {showManualEntry ? "Hide" : "Can&apos;t scan? Enter code manually"}
        </button>

        {showManualEntry && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Manual Entry Key:
            </h4>
            <div className="bg-white dark:bg-gray-900 p-3 rounded border font-mono text-sm break-all">
              {setupState.manualEntryKey}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Enter this key manually in your authenticator app
            </p>
          </div>
        )}
      </div>

      <div className="flex space-x-4 justify-center pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          I&apos;ve Added the Account
        </button>
      </div>
    </div>
  );
};

// Step 3: Verification Component
const VerificationStep = ({ onNext, onPrev }: StepProps) => {
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const {
    execute: verify2FASetup,
    status: verifyStatus,
  } = useAction(verify2FASetupAction);

  const handleVerification = async () => {
    if (verificationCode.length < 6) {
      setVerificationError("Please enter a valid 6-digit code");
      return;
    }

    setIsVerifying(true);
    setVerificationError("");

    try {
      const result = await verify2FASetup({ code: verificationCode }) as any;
      
      if (result?.success) {
        onNext();
      } else {
        setVerificationError("Invalid code. Please try again.");
      }
    } catch {
      setVerificationError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
    if (verificationError) {
      setVerificationError("");
    }
  };

  const isLoading = isVerifying || verifyStatus === "executing";

  return (
    <div className="text-center space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Verify Setup
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Enter the 6-digit code from your authenticator app to verify the setup
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="verification-code" className="sr-only">
            Verification Code
          </label>
          <input
            type="text"
            id="verification-code"
            value={verificationCode}
            onChange={handleCodeChange}
            placeholder="000000"
            disabled={isLoading}
            className={`w-48 mx-auto text-center text-2xl font-mono tracking-wider px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${
              verificationError
                ? "border-red-500 dark:border-red-400"
                : "border-gray-300 dark:border-gray-600"
            }`}
            autoComplete="off"
          />
          {verificationError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {verificationError}
            </p>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            💡 Open your authenticator app and find the 6-digit code for your account.
            The code changes every 30 seconds.
          </p>
        </div>
      </div>

      <div className="flex space-x-4 justify-center pt-4">
        <button
          onClick={onPrev}
          disabled={isLoading}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleVerification}
          disabled={isLoading || verificationCode.length !== 6}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Verifying..." : "Verify & Continue"}
        </button>
      </div>
    </div>
  );
};

// Step 4: Backup Codes Component
const BackupCodesStep = ({ onNext, onPrev, setupState }: StepProps) => {
  const [codesCopied, setCodesCopied] = useState(false);
  const [codesDownloaded, setCodesDownloaded] = useState(false);

  const handleCopyBackupCodes = async () => {
    const success = await copyBackupCodes(setupState.backupCodes);
    if (success) {
      setCodesCopied(true);
      setTimeout(() => setCodesCopied(false), 3000);
    }
  };

  const handleDownloadBackupCodes = () => {
    downloadBackupCodes(setupState.backupCodes);
    setCodesDownloaded(true);
  };

  const formattedCodes = formatBackupCodes(setupState.backupCodes);

  return (
    <div className="text-center space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Save Your Backup Codes
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Store these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
        </p>
      </div>

      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-start space-x-3">
          <div className="text-red-600 dark:text-red-400 text-lg">🚨</div>
          <div className="text-left">
            <h4 className="font-medium text-red-900 dark:text-red-200 mb-1">Critical:</h4>
            <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
              <li>• Each code can only be used once</li>
              <li>• Keep them secure - don&apos;t share with anyone</li>
              <li>• Store them separately from your main device</li>
              <li>• You won&apos;t be able to see these codes again</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          {formattedCodes.map((codePair, pairIndex) => (
            <div key={pairIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {codePair.map((code, codeIndex) => {
                const codeNumber = pairIndex * 2 + codeIndex + 1;
                return (
                  <div
                    key={codeIndex}
                    className="bg-gray-50 dark:bg-gray-700 p-3 rounded border font-mono text-sm"
                  >
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {codeNumber.toString().padStart(2, '0')}.
                    </span>{' '}
                    <span className="font-medium">{code}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleCopyBackupCodes}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          {codesCopied ? "✓ Copied!" : "📋 Copy Codes"}
        </button>
        <button
          onClick={handleDownloadBackupCodes}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          {codesDownloaded ? "✓ Downloaded!" : "💾 Download Codes"}
        </button>
      </div>

      <div className="flex space-x-4 justify-center pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          I&apos;ve Saved My Codes
        </button>
      </div>
    </div>
  );
};

// Step 5: Completion Component  
const CompletionStep = ({ onSetupComplete }: Omit<StepProps, 'onNext' | 'onCancel'> & { onSetupComplete?: (user: AuthUser) => void }) => {
  const handleFinish = () => {
    // In a real implementation, you might want to return the updated user
    // For now, we'll just call the callback
    onSetupComplete?.(null as unknown as AuthUser);
  };

  return (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-4">🎉</div>
      
      <div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Two-Factor Authentication Enabled!
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Your account is now protected with two-factor authentication.
        </p>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
        <h4 className="font-medium text-green-900 dark:text-green-200 mb-2">What happens next:</h4>
        <ul className="text-sm text-green-800 dark:text-green-300 space-y-1 text-left">
          <li>• You&apos;ll need your authenticator app code every time you log in</li>
          <li>• Your backup codes are saved and ready to use if needed</li>
          <li>• You can manage your 2FA settings in your security preferences</li>
          <li>• You can generate new backup codes anytime</li>
        </ul>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 dark:text-blue-400 text-lg">💡</div>
          <div className="text-left">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">Pro Tips:</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Set up 2FA on multiple devices for redundancy</li>
              <li>• Test your backup codes to make sure they work</li>
              <li>• Keep your authenticator app updated</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={handleFinish}
          className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
        >
          Complete Setup
        </button>
      </div>
    </div>
  );
};

// Main TwoFactorSetup Component
export default function TwoFactorSetup({
  onSetupComplete,
  onCancel,
  className = "",
}: TwoFactorSetupProps) {
  const [setupState, setSetupState] = useState<SetupState>({
    step: 1,
    secret: "",
    qrCodeImage: "",
    manualEntryKey: "",
    backupCodes: [],
    isLoading: false,
    error: null,
  });

  // Cleanup sensitive data on unmount
  useEffect(() => {
    return () => {
      setSetupState({
        step: 1,
        secret: "",
        qrCodeImage: "",
        manualEntryKey: "",
        backupCodes: [],
        isLoading: false,
        error: null,
      });
    };
  }, []);

  const handleNext = useCallback(() => {
    setSetupState(prev => ({
      ...prev,
      step: Math.min(prev.step + 1, TOTAL_STEPS)
    }));
  }, []);

  const handlePrev = useCallback(() => {
    setSetupState(prev => ({
      ...prev,
      step: Math.max(prev.step - 1, 1)
    }));
  }, []);

  const handleCancel = useCallback(() => {
    // Clear sensitive data before canceling
    setSetupState({
      step: 1,
      secret: "",
      qrCodeImage: "",
      manualEntryKey: "",
      backupCodes: [],
      isLoading: false,
      error: null,
    });
    onCancel?.();
  }, [onCancel]);

  const renderCurrentStep = () => {
    const commonProps = {
      onNext: handleNext,
      onPrev: handlePrev,
      onCancel: handleCancel,
      setupState,
      setSetupState,
    };

    switch (setupState.step) {
      case 1:
        return <IntroductionStep {...commonProps} />;
      case 2:
        return <QRCodeStep {...commonProps} />;
      case 3:
        return <VerificationStep {...commonProps} />;
      case 4:
        return <BackupCodesStep {...commonProps} />;
      case 5:
        return <CompletionStep {...commonProps} onSetupComplete={onSetupComplete} />;
      default:
        return <IntroductionStep {...commonProps} />;
    }
  };

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <ProgressIndicator
          currentStep={setupState.step}
          totalSteps={TOTAL_STEPS}
          stepNames={STEP_NAMES}
        />
        
        <div className="min-h-[400px]">
          {renderCurrentStep()}
        </div>
      </div>
    </div>
  );
}