"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LoginForm from "./forms/LoginForm";
import RegisterForm from "./forms/RegisterForm";
import { AuthManagerState } from "./types/auth.types";

export default function AuthManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [state, setState] = useState<AuthManagerState>({
    currentForm: pathname === "/register" ? "register" : "login",
    authState: {
      loading: false,
      error: null,
      success: null,
      requires2FA: false,
      requiresVerification: false,
    },
    user: null,
    twoFactorData: null,
  });

  // Initialize based on URL or search params
  useEffect(() => {
    const registered = searchParams.get("registered");

    // Set form based on pathname
    const currentForm = pathname === "/register" ? "register" : "login";

    setState((prev) => ({
      ...prev,
      currentForm,
      authState: {
        ...prev.authState,
        success:
          registered === "true"
            ? "Registration successful! Please check your email to verify your account before signing in."
            : null,
      },
    }));
  }, [pathname, searchParams]);

  const handleLoginSuccess = (result: any) => {
    console.log("Login successful:", result);

    setState((prev) => ({
      ...prev,
      authState: {
        ...prev.authState,
        loading: false,
        error: null,
        success: "Login successful! Redirecting...",
      },
      user: result.user,
    }));

    // Redirect to dashboard or intended page
    const redirectTo = searchParams.get("redirect") || "/dashboard";
    setTimeout(() => {
      router.push(redirectTo);
    }, 1000);
  };

  const handleLoginError = (error: string) => {
    console.error("Login error:", error);

    setState((prev) => ({
      ...prev,
      authState: {
        ...prev.authState,
        loading: false,
        error,
        success: null,
      },
    }));
  };

  const handleLoginRequires2FA = (data: any) => {
    console.log("2FA required:", data);

    setState((prev) => ({
      ...prev,
      authState: {
        ...prev.authState,
        loading: false,
        requires2FA: true,
        error: null,
      },
      twoFactorData: data,
      currentForm: "2fa",
    }));
  };

  const handleRegisterSuccess = (result: any) => {
    console.log("Registration successful:", result);

    setState((prev) => ({
      ...prev,
      authState: {
        ...prev.authState,
        loading: false,
        error: null,
        success:
          result.message ||
          "Registration successful! Please check your email to verify your account.",
        requiresVerification: result.requiresVerification,
      },
    }));

    // Switch to login form after successful registration
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        currentForm: "login",
        authState: {
          ...prev.authState,
          success:
            "Registration successful! You can now sign in after verifying your email.",
        },
      }));
    }, 3000);
  };

  const handleRegisterError = (error: string) => {
    console.error("Registration error:", error);

    setState((prev) => ({
      ...prev,
      authState: {
        ...prev.authState,
        loading: false,
        error,
        success: null,
      },
    }));
  };

  const switchForm = (
    form: "login" | "register" | "2fa" | "forgot-password" | "reset-password"
  ) => {
    setState((prev) => ({
      ...prev,
      currentForm: form,
      authState: {
        ...prev.authState,
        error: null,
        success: null,
      },
    }));

    // Update URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("form", form);
    router.replace(newUrl.pathname + newUrl.search);
  };

  const clearMessages = () => {
    setState((prev) => ({
      ...prev,
      authState: {
        ...prev.authState,
        error: null,
        success: null,
      },
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Global Success Message */}
        {state.authState.success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400">✓</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-600 dark:text-green-400">
                  {state.authState.success}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={clearMessages}
                  className="inline-flex text-green-400 hover:text-green-600 focus:outline-none focus:text-green-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <span>×</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Message */}
        {state.authState.error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {state.authState.error}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={clearMessages}
                  className="inline-flex text-red-400 hover:text-red-600 focus:outline-none focus:text-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <span>×</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Renderer */}
        {state.currentForm === "login" && (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            onRequires2FA={handleLoginRequires2FA}
          />
        )}

        {state.currentForm === "register" && (
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onError={handleRegisterError}
            autoLoginAfterRegistration={false}
          />
        )}

        {state.currentForm === "2fa" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Two-Factor Authentication
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Please enter the code from your authenticator app.
              </p>
            </div>

            {/* TODO: Implement 2FA form */}
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                2FA form implementation coming soon...
              </p>
              <button
                onClick={() => switchForm("login")}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                Back to login
              </button>
            </div>
          </div>
        )}

        {/* Development Info */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Debug Info (Development Only)
            </h3>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <div>Current Form: {state.currentForm}</div>
              <div>Loading: {state.authState.loading.toString()}</div>
              <div>Requires 2FA: {state.authState.requires2FA.toString()}</div>
              <div>
                Requires Verification:{" "}
                {state.authState.requiresVerification.toString()}
              </div>
              {state.user && <div>User: {String(state.user.email || 'N/A')}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
