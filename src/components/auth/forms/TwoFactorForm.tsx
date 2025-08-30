"use client";

import { complete2FAAction } from "@/actions/auth.actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";

// Types
interface TwoFactorFormProps {
  userId?: string;
  sessionId?: string;
  onVerificationSuccess?: (user: Record<string, unknown>) => void;
  onCancel?: () => void;
  redirectUrl?: string;
  className?: string;
}

interface TwoFactorFormData {
  code: string;
  rememberDevice: boolean;
}

interface TwoFactorFormErrors {
  code?: string;
  general?: string;
}

type InputMode = "totp" | "backup";

export default function TwoFactorForm({
  onVerificationSuccess,
  onCancel,
  redirectUrl,
  className = "",
}: TwoFactorFormProps) {
  const router = useRouter();
  const codeInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<TwoFactorFormData>({
    code: "",
    rememberDevice: false,
  });
  const [errors, setErrors] = useState<TwoFactorFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("totp");
  const [attempts, setAttempts] = useState(0);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Auto-focus code input on mount and mode change
  useEffect(() => {
    const timer = setTimeout(() => {
      codeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [inputMode]);

  // Rate limit countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (rateLimitedUntil && countdown > 0) {
      interval = setInterval(() => {
        const remaining = Math.ceil((rateLimitedUntil.getTime() - Date.now()) / 1000);
        if (remaining <= 0) {
          setRateLimitedUntil(null);
          setCountdown(0);
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [rateLimitedUntil, countdown]);

  const validateCode = useCallback((code: string): string | null => {
    if (!code.trim()) {
      return "Verification code is required";
    }
    
    if (inputMode === "totp") {
      if (!/^\d{6}$/.test(code)) {
        return "TOTP code must be exactly 6 digits";
      }
    } else {
      if (!/^[A-Za-z0-9]{8}$/.test(code)) {
        return "Backup code must be exactly 8 alphanumeric characters";
      }
    }
    
    return null;
  }, [inputMode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Format based on input mode
    if (inputMode === "totp") {
      // Only allow digits, max 6 characters
      value = value.replace(/\D/g, "").slice(0, 6);
    } else {
      // Allow alphanumeric for backup codes, max 8 characters
      value = value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
    }
    
    setFormData(prev => ({ ...prev, code: value }));
    
    // Clear code error when user types
    if (errors.code) {
      setErrors(prev => ({ ...prev, code: undefined }));
    }
    
    // Clear general error when user makes changes
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").trim();
    
    let processedText = "";
    if (inputMode === "totp") {
      processedText = pastedText.replace(/\D/g, "").slice(0, 6);
    } else {
      processedText = pastedText.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
    }
    
    setFormData(prev => ({ ...prev, code: processedText }));
    
    // Auto-submit if complete code is pasted
    if (
      (inputMode === "totp" && processedText.length === 6) ||
      (inputMode === "backup" && processedText.length === 8)
    ) {
      setTimeout(() => handleSubmit(null, processedText), 100);
    }
  };

  const handleRememberDeviceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, rememberDevice: e.target.checked }));
  };

  const clearFormData = useCallback(() => {
    setFormData(prev => ({ ...prev, code: "" }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent | null, codeOverride?: string) => {
    if (e) e.preventDefault();
    
    const codeToUse = codeOverride || formData.code;
    const validationError = validateCode(codeToUse);
    
    if (validationError) {
      setErrors({ code: validationError });
      return;
    }

    // Check rate limiting
    if (rateLimitedUntil && Date.now() < rateLimitedUntil.getTime()) {
      setErrors({ general: `Too many attempts. Please wait ${countdown} seconds.` });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const result = await complete2FAAction({
        code: codeToUse,
        rememberMe: formData.rememberDevice,
      });

      if (result?.data?.success) {
        // Success - handle verification completion
        onVerificationSuccess?.(result.data.user);
        
        // Navigate to redirect URL or dashboard
        const targetUrl = redirectUrl || "/dashboard";
        router.push(targetUrl);
        
        // Reset form state
        clearFormData();
        setAttempts(0);
      } else if (result?.serverError) {
        const errorMessage = result.serverError;
        
        // Handle specific error types
        if (errorMessage.includes("Invalid") || errorMessage.includes("expired")) {
          setErrors({ code: "Invalid or expired code. Please try again." });
        } else if (errorMessage.includes("rate limit") || errorMessage.includes("Too many")) {
          // Set rate limiting
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          
          const limitSeconds = Math.min(30 + (newAttempts * 10), 300); // Max 5 minutes
          const limitUntil = new Date(Date.now() + limitSeconds * 1000);
          setRateLimitedUntil(limitUntil);
          setCountdown(limitSeconds);
          
          setErrors({ general: `Too many attempts. Please wait ${limitSeconds} seconds before trying again.` });
        } else {
          setErrors({ general: errorMessage });
        }
        
        // Clear code after failed attempt
        clearFormData();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Verification failed. Please try again.";
      setErrors({ general: errorMessage });
      clearFormData();
    } finally {
      setLoading(false);
      // Refocus input after submission
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [formData.code, formData.rememberDevice, attempts, rateLimitedUntil, countdown, clearFormData, onVerificationSuccess, redirectUrl, router, inputMode, validateCode]);

  const handleModeToggle = () => {
    const newMode = inputMode === "totp" ? "backup" : "totp";
    setInputMode(newMode);
    clearFormData();
    setErrors({});
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/login");
    }
  };

  // Auto-submit when TOTP code is complete
  useEffect(() => {
    if (inputMode === "totp" && formData.code.length === 6 && !loading) {
      const timer = setTimeout(() => {
        handleSubmit(null);
      }, 300); // Small delay for better UX
      return () => clearTimeout(timer);
    }
  }, [formData.code, inputMode, loading, handleSubmit]);

  const isRateLimited = Boolean(rateLimitedUntil && Date.now() < rateLimitedUntil.getTime());

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Two-Factor Authentication
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {inputMode === "totp" 
            ? "Enter the 6-digit code from your authenticator app"
            : "Enter one of your backup codes"
          }
        </p>
      </div>

      {/* General Error */}
      {errors.general && (
        <div 
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.general}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Code Input */}
        <div>
          <label
            htmlFor="code"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {inputMode === "totp" ? "Authentication Code" : "Backup Code"}
          </label>
          <input
            ref={codeInputRef}
            type={inputMode === "totp" ? "text" : "text"}
            id="code"
            name="code"
            value={formData.code}
            onChange={handleCodeChange}
            onPaste={handlePaste}
            disabled={loading || isRateLimited}
            inputMode={inputMode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            className={`w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-center text-lg font-mono tracking-widest ${
              errors.code
                ? "border-red-500 dark:border-red-400"
                : "border-gray-300 dark:border-gray-600"
            }`}
            placeholder={inputMode === "totp" ? "123456" : "ABCD1234"}
            maxLength={inputMode === "totp" ? 6 : 8}
            aria-describedby={errors.code ? "code-error" : undefined}
            aria-invalid={errors.code ? "true" : "false"}
          />
          {errors.code && (
            <p id="code-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.code}
            </p>
          )}
        </div>

        {/* Mode Toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleModeToggle}
            disabled={loading || isRateLimited}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inputMode === "totp" 
              ? "Use a backup code instead"
              : "Use authenticator app code instead"
            }
          </button>
        </div>

        {/* Remember Device */}
        <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <input
            type="checkbox"
            id="rememberDevice"
            name="rememberDevice"
            checked={formData.rememberDevice}
            onChange={handleRememberDeviceChange}
            disabled={loading || isRateLimited}
            className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex-1 min-w-0">
            <label htmlFor="rememberDevice" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Remember this device for 30 days
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              You won&apos;t need to enter a code on this device for 30 days. Only use on trusted devices.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || isRateLimited || !formData.code}
          className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading 
            ? "Verifying..." 
            : isRateLimited 
              ? `Wait ${countdown}s` 
              : "Verify Code"
          }
        </button>

        {/* Help Text */}
        <div className="text-center space-y-2">
          {inputMode === "totp" && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Open your authenticator app (Google Authenticator, Authy, etc.) to get your code
            </p>
          )}
          
          {/* Fallback Options */}
          <div className="flex justify-center space-x-4 text-sm">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <Link
              href="/account-recovery"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
            >
              Account Recovery
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}