"use server";

import { AuthService } from "@/services/AuthService";
import { createSafeActionClient } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

// Create safe action client
const action = createSafeActionClient({
  handleServerError: (e) => {
    // Log error for debugging
    console.error("Server action error:", e);

    // Return user-friendly error message
    if (e.message.includes("Invalid credentials")) {
      return "Invalid email or password";
    }

    if (e.message.includes("already exists")) {
      return "An account with this email already exists";
    }

    return e.message || "An unexpected error occurred";
  },
});

// Auth middleware for protected actions
const authAction = action.use(async ({ next }) => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const authService = AuthService.getInstance();
  const user = await authService.getUserBySession(sessionToken);

  if (!user) {
    // Clear invalid session cookie
    cookieStore.delete("session");
    throw new Error("Invalid session");
  }

  return next({ ctx: { user, sessionToken } });
});

// Helper to get client IP and User-Agent
async function getClientInfo() {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || undefined;
  const forwarded = headersList.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : headersList.get("x-real-ip") ||
      headersList.get("remote-addr") ||
      undefined;

  return { userAgent, ipAddress };
}

// Login Action
export const loginAction = action
  .schema(
    z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(1, "Password is required"),
      rememberMe: z.boolean().optional().default(false),
    })
  )
  .action(async ({ parsedInput }) => {
    const { email, password, rememberMe } = parsedInput;
    const { userAgent, ipAddress } = await getClientInfo();

    const authService = AuthService.getInstance();
    const result = await authService.login(
      email,
      password,
      rememberMe,
      ipAddress,
      userAgent
    );

    const cookieStore = await cookies();

    if (result.requires2FA) {
      // Store 2FA token temporarily in cookie
      cookieStore.set("2fa-token", result.twoFactorToken!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60, // 10 minutes
        path: "/",
      });

      return {
        success: true,
        requires2FA: true,
        user: result.user.toJSON(),
      };
    }

    // Set session cookie
    cookieStore.set("session", result.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // 30 days or 1 day
      path: "/",
    });

    return {
      success: true,
      user: result.user.toJSON(),
      sessionExpires: result.session.expiresAt.toISOString(),
    };
  });

// Complete 2FA Login Action
export const complete2FAAction = action
  .schema(
    z.object({
      code: z.string().min(6, "Code must be at least 6 characters"),
      rememberMe: z.boolean().optional().default(false),
    })
  )
  .action(async ({ parsedInput }) => {
    const { code, rememberMe } = parsedInput;
    const { userAgent, ipAddress } = await getClientInfo();

    const cookieStore = await cookies();
    const twoFactorToken = cookieStore.get("2fa-token")?.value;
    if (!twoFactorToken) {
      throw new Error("2FA token not found or expired");
    }

    const authService = AuthService.getInstance();
    const result = await authService.complete2FALogin(
      twoFactorToken,
      code,
      rememberMe,
      ipAddress,
      userAgent
    );

    // Clear 2FA token cookie
    cookieStore.delete("2fa-token");

    // Set session cookie
    cookieStore.set("session", result.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
      path: "/",
    });

    return {
      success: true,
      user: result.user.toJSON(),
      sessionExpires: result.session.expiresAt.toISOString(),
    };
  });

// Register schema
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  acceptTerms: z.boolean().refine(function (val) {
    return val === true;
  }, "You must accept the terms and conditions"),
});

// Register Action
export const registerAction = action
  .schema(registerSchema)
  .action(async ({ parsedInput }) => {
    const authService = AuthService.getInstance();
    const user = await authService.register(parsedInput);

    return {
      success: true,
      requiresVerification: !user.emailVerified,
      message:
        "Registration successful! Please check your email to verify your account.",
    };
  });

// Logout Action
export const logoutAction = authAction.action(async ({ ctx }) => {
  const authService = AuthService.getInstance();
  await authService.logout(ctx.sessionToken);

  // Clear session cookie
  const cookieStore = await cookies();
  cookieStore.delete("session");

  // Redirect to login page
  redirect("/login");
});

// Logout All Devices Action
export const logoutAllDevicesAction = authAction.action(async ({ ctx }) => {
  const authService = AuthService.getInstance();
  const revokedCount = await authService.logoutAllDevices(
    ctx.user.id,
    ctx.sessionToken
  );

  return {
    success: true,
    revokedSessions: revokedCount,
    message: `Logged out from ${revokedCount} other devices`,
  };
});

// Verify Email Action
export const verifyEmailAction = action
  .schema(
    z.object({
      token: z.string().min(1, "Verification token is required"),
    })
  )
  .action(async ({ parsedInput }) => {
    const authService = AuthService.getInstance();
    const success = await authService.verifyEmail(parsedInput.token);

    return {
      success,
      message: "Email verified successfully! You can now log in.",
    };
  });

// Resend Verification Email Action
export const resendVerificationAction = action
  .schema(
    z.object({
      email: z.string().email("Invalid email address"),
    })
  )
  .action(async ({ parsedInput }) => {
    const authService = AuthService.getInstance();
    await authService.resendVerificationEmail(parsedInput.email);

    return {
      success: true,
      message: "Verification email sent! Please check your inbox.",
    };
  });

// Initiate Password Reset Action
export const initiatePasswordResetAction = action
  .schema(
    z.object({
      email: z.string().email("Invalid email address"),
    })
  )
  .action(async ({ parsedInput }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    
    try {
      const { PasswordResetService } = await import("@/services/PasswordResetService");
      const passwordResetService = PasswordResetService.getInstance();
      
      const result = await passwordResetService.initiatePasswordReset({
        email: parsedInput.email,
        ipAddress,
        userAgent,
      });

      return {
        success: result.success,
        message: result.message,
        rateLimitInfo: result.rateLimitInfo,
      };
    } catch (error) {
      const { RateLimitError, SecurityError } = await import("@/lib/password-reset-utils");
      
      if (error instanceof RateLimitError) {
        const retryAfterSeconds = Math.ceil((error.retryAfterMs || 0) / 1000);
        throw new Error(`Too many requests. Try again in ${retryAfterSeconds} seconds.`);
      }
      
      if (error instanceof SecurityError) {
        throw new Error(error.message);
      }
      
      // Log unexpected errors but don't expose details
      console.error("Password reset initiation error:", error);
      throw new Error("Password reset request failed. Please try again later.");
    }
  });

// Reset password schema
const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine(
    function (data) {
      return data.password === data.confirmPassword;
    },
    {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }
  );

// Reset Password Action
export const resetPasswordAction = action
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    
    try {
      const { PasswordResetService } = await import("@/services/PasswordResetService");
      const passwordResetService = PasswordResetService.getInstance();
      
      const result = await passwordResetService.resetPassword({
        token: parsedInput.token,
        newPassword: parsedInput.password,
        confirmPassword: parsedInput.confirmPassword,
        ipAddress,
        userAgent,
      });

      return {
        success: result.success,
        message: result.message,
        revokedSessions: result.revokedSessions,
      };
    } catch (error) {
      const { TokenError, SecurityError } = await import("@/lib/password-reset-utils");
      
      if (error instanceof TokenError) {
        throw new Error("Invalid or expired reset token. Please request a new password reset.");
      }
      
      if (error instanceof SecurityError) {
        throw new Error(error.message);
      }
      
      // Log unexpected errors but don't expose details
      console.error("Password reset completion error:", error);
      throw new Error("Password reset failed. Please try again or request a new reset link.");
    }
  });

// Validate Password Reset Token Action
export const validateResetTokenAction = action
  .schema(
    z.object({
      token: z.string().min(1, "Reset token is required"),
    })
  )
  .action(async ({ parsedInput }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    
    try {
      const { PasswordResetService } = await import("@/services/PasswordResetService");
      const passwordResetService = PasswordResetService.getInstance();
      
      const result = await passwordResetService.validateResetToken({
        token: parsedInput.token,
        ipAddress,
        userAgent,
      });

      return {
        isValid: result.isValid,
        errors: result.errors,
        tokenData: result.tokenData,
      };
    } catch (error) {
      // Log unexpected errors but don't expose details
      console.error("Token validation error:", error);
      return {
        isValid: false,
        errors: ["Token validation failed"],
      };
    }
  });

// Change password schema
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine(
    function (data) {
      return data.newPassword === data.confirmPassword;
    },
    {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }
  );

// Change Password Action
export const changePasswordAction = authAction
  .schema(changePasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const authService = AuthService.getInstance();
    await authService.changePassword(
      ctx.user.id,
      parsedInput.currentPassword,
      parsedInput.newPassword
    );

    return {
      success: true,
      message:
        "Password changed successfully! You've been logged out from other devices for security.",
    };
  });

// Update Profile Action
export const updateProfileAction = authAction
  .schema(
    z.object({
      name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(50)
        .optional(),
      phone: z.string().optional(),
      timezone: z.string().optional(),
      preferredCurrency: z.string().optional(),
      image: z.string().optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const authService = AuthService.getInstance();
    const updatedUser = await authService.updateProfile(
      ctx.user.id,
      parsedInput
    );

    // Revalidate profile pages
    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return {
      success: true,
      user: updatedUser.toJSON(),
      message: "Profile updated successfully!",
    };
  });

// Setup 2FA Action
export const setup2FAAction = authAction.action(async ({ ctx }) => {
  const authService = AuthService.getInstance();
  const setup = await authService.setup2FA(ctx.user.id);

  return {
    success: true,
    secret: setup.secret,
    qrCode: setup.qrCode,
    backupCodes: setup.backupCodes,
  };
});

// Enable 2FA Action
export const enable2FAAction = authAction
  .schema(
    z.object({
      code: z.string().min(6, "Code must be at least 6 characters"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const authService = AuthService.getInstance();
    await authService.enable2FA(ctx.user.id, parsedInput.code);

    // Revalidate security pages
    revalidatePath("/profile/security");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Two-factor authentication enabled successfully!",
    };
  });

// Disable 2FA Action
export const disable2FAAction = authAction
  .schema(
    z.object({
      password: z.string().min(1, "Password is required"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const authService = AuthService.getInstance();
    await authService.disable2FA(ctx.user.id, parsedInput.password);

    // Revalidate security pages
    revalidatePath("/profile/security");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Two-factor authentication disabled successfully!",
    };
  });
