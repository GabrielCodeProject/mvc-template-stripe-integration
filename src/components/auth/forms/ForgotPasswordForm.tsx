"use client";

import { initiatePasswordResetAction } from "@/actions/auth.actions";
import Link from "next/link";
import { useState } from "react";

interface ForgotPasswordFormProps {
  onSuccess?: (email: string) => void;
  className?: string;
}

interface ForgotPasswordFormData {
  email: string;
}

interface ForgotPasswordFormErrors {
  email?: string;
  general?: string;
}

export default function ForgotPasswordForm({
  onSuccess,
  className = "",
}: ForgotPasswordFormProps) {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: "",
  });
  const [errors, setErrors] = useState<ForgotPasswordFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: ForgotPasswordFormErrors = {};

    // Client-side validation
    if (!formData.email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const result = await initiatePasswordResetAction({
        email: formData.email.toLowerCase().trim(),
      });

      if (result?.data?.success) {
        setSubmitted(true);
        onSuccess?.(formData.email);
      } else if (result?.serverError) {
        // Even with enumeration protection, still show the error
        setErrors({ general: result.serverError });
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
    if (errors[name as keyof ForgotPasswordFormErrors]) {
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
  };

  // Success state - show confirmation message
  if (submitted) {
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
            Check Your Email
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            If an account with <strong className="text-gray-900 dark:text-gray-100">{formData.email}</strong> exists, 
            we&rsquo;ve sent you password reset instructions.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-400 dark:text-blue-300 mt-0.5 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">What to do next:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Check your email inbox and spam folder</li>
                  <li>Click the reset link within 15 minutes</li>
                  <li>Follow the instructions to create a new password</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/login"
              className="w-full inline-flex justify-center px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              Back to Sign In
            </Link>
            
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setFormData({ email: "" });
                setErrors({});
              }}
              className="w-full px-4 py-2 text-indigo-600 dark:text-indigo-400 bg-transparent border border-indigo-600 dark:border-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              Try a Different Email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Forgot Your Password?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Enter your email address and we&rsquo;ll send you instructions to reset your password.
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
        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
            autoComplete="email"
            autoFocus
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              errors.email
                ? "border-red-500 dark:border-red-400 focus:ring-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
            placeholder="Enter your email address"
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p 
              id="email-error" 
              className="mt-1 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-describedby="submit-description"
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
              Sending Instructions...
            </span>
          ) : (
            "Send Reset Instructions"
          )}
        </button>
        
        <div id="submit-description" className="sr-only">
          This will send password reset instructions to your email if an account exists
        </div>

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
              <p className="font-medium mb-1">Security Notice</p>
              <p>
                For your security, we don&rsquo;t reveal whether an account exists. 
                Reset links expire in 15 minutes and can only be used once.
              </p>
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