"use client";

import { resetPasswordAction } from "@/actions/auth.actions";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import { PasswordStrength } from "@/lib/password-strength";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

interface ResetPasswordFormProps {
  token: string;
  onSuccess?: () => void;
  className?: string;
}

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

interface ResetPasswordFormErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
  token?: string;
}

export default function ResetPasswordForm({
  token,
  onSuccess,
  className = "",
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<ResetPasswordFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Password strength change handler (moved before conditionals)
  const handlePasswordStrengthChange = useCallback((strength: PasswordStrength) => {
    setPasswordStrength(strength);
    
    // Clear password error if strength improves
    if (strength.level !== "weak" && errors.password === "Please choose a stronger password") {
      setErrors((prev) => ({
        ...prev,
        password: undefined,
      }));
    }
  }, [errors.password]);

  // Check if token exists on mount
  if (!token || token.trim() === "") {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Invalid Reset Link
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This password reset link is invalid or missing. Please request a new one.
          </p>

          <Link
            href="/forgot-password"
            className="w-full inline-flex justify-center px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  const validatePasswords = (): boolean => {
    const newErrors: ResetPasswordFormErrors = {};

    // Password validation
    if (!formData.password.trim()) {
      newErrors.password = "New password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Password must contain at least one uppercase letter, one lowercase letter, and one number";
    }

    // Confirm password validation
    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    // Check password strength
    if (passwordStrength && passwordStrength.level === "weak") {
      newErrors.password = "Please choose a stronger password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const result = await resetPasswordAction({
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (result?.data?.success) {
        setResetSuccess(true);
        onSuccess?.();
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else if (result?.serverError) {
        if (result.serverError.includes("expired") || result.serverError.includes("invalid")) {
          setErrors({ token: result.serverError });
        } else {
          setErrors({ general: result.serverError });
        }
      } else if (result?.validationErrors) {
        // Handle Zod validation errors
        const validationErrors: ResetPasswordFormErrors = {};
        Object.entries(result.validationErrors).forEach(([key, messages]) => {
          if (Array.isArray(messages) && messages.length > 0) {
            validationErrors[key as keyof ResetPasswordFormErrors] = messages[0];
          }
        });
        setErrors(validationErrors);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear errors when user starts typing
    if (errors[name as keyof ResetPasswordFormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }

    // Clear general error when user makes changes
    if (errors.general) {
      setErrors((prev) => ({
        ...prev,
        general: undefined,
      }));
    }

    // Real-time password confirmation validation
    if (name === "confirmPassword" || name === "password") {
      setTimeout(() => {
        if (formData.password && formData.confirmPassword && name === "confirmPassword") {
          if (value !== formData.password && name === "confirmPassword") {
            setErrors((prev) => ({
              ...prev,
              confirmPassword: "Passwords don't match",
            }));
          }
        }
        if (formData.confirmPassword && formData.password && name === "password") {
          if (value !== formData.confirmPassword && name === "password") {
            setErrors((prev) => ({
              ...prev,
              confirmPassword: "Passwords don't match",
            }));
          }
        }
      }, 500);
    }
  };

  // Success state
  if (resetSuccess) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600 dark:text-green-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Password Reset Successful!
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 mb-6">
            <p className="text-sm text-green-800 dark:text-green-200">
              You&rsquo;ll be automatically redirected to the sign in page in a few seconds...
            </p>
          </div>

          <Link
            href="/login"
            className="w-full inline-flex justify-center px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            Sign In Now
          </Link>
        </div>
      </div>
    );
  }

  // Token error state
  if (errors.token) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Reset Link Expired
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {errors.token}
          </p>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please request a new password reset link to continue.
          </p>

          <Link
            href="/forgot-password"
            className="w-full inline-flex justify-center px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Reset Your Password
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Enter your new password below. Make sure it&rsquo;s strong and secure.
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* New Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                errors.password
                  ? "border-red-500 dark:border-red-400 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Enter your new password"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : "password-help"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <span className="text-gray-500 dark:text-gray-400">
                {showPassword ? "🙈" : "👁️"}
              </span>
            </button>
          </div>
          {errors.password && (
            <p 
              id="password-error" 
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {errors.password}
            </p>
          )}
          <p id="password-help" className="sr-only">
            Password must be at least 8 characters and contain uppercase, lowercase, and numbers
          </p>
        </div>

        {/* Password Strength Indicator */}
        {formData.password && (
          <PasswordStrengthIndicator
            password={formData.password}
            onChange={handlePasswordStrengthChange}
            minStrength="fair"
            className="mt-2"
          />
        )}

        {/* Confirm Password Field */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              autoComplete="new-password"
              className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                errors.confirmPassword
                  ? "border-red-500 dark:border-red-400 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Confirm your new password"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              <span className="text-gray-500 dark:text-gray-400">
                {showConfirmPassword ? "🙈" : "👁️"}
              </span>
            </button>
          </div>
          {errors.confirmPassword && (
            <p 
              id="confirm-password-error" 
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !formData.password || !formData.confirmPassword || passwordStrength?.level === "weak"}
          className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Resetting Password...
            </span>
          ) : (
            "Reset Password"
          )}
        </button>

        {/* Security Notice */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">Security Tips</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a unique password you haven&rsquo;t used elsewhere</li>
                <li>Consider using a password manager</li>
                <li>This link can only be used once and expires in 15 minutes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back to Login */}
        <div className="text-center pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}