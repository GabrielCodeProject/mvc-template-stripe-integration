"use server";

import { UserProfileService } from "@/services/UserProfileService";
import { SocialLinks, UserPreferences } from "@/models/UserProfile";
import { createSafeActionClient } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { AuthService } from "@/services/AuthService";

// Create safe action client
const action = createSafeActionClient({
  handleServerError: (e) => {
    console.error("Profile action error:", e);

    if (e.message.includes("Too many")) {
      return "Rate limit exceeded. Please wait before trying again.";
    }

    if (e.message.includes("Invalid URL")) {
      return "Please provide valid URLs for links and websites.";
    }

    if (e.message.includes("already exists")) {
      return "This information is already in use by another user.";
    }

    return e.message || "An unexpected error occurred";
  },
});

// Auth middleware for protected profile actions
const authAction = action.use(async ({ next }) => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const authService = AuthService.getInstance();
  const user = await authService.getUserBySession(sessionToken);

  if (!user) {
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

// Schema definitions
const socialLinksSchema = z.object({
  twitter: z.string().url().optional().or(z.literal("")),
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  youtube: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().optional(),
  emailNotifications: z.object({
    marketing: z.boolean().optional(),
    security: z.boolean().optional(),
    updates: z.boolean().optional(),
    digest: z.boolean().optional(),
  }).optional(),
  privacySettings: z.object({
    profileVisibility: z.enum(["public", "private", "friends"]).optional(),
    showEmail: z.boolean().optional(),
    showPhone: z.boolean().optional(),
    showBirthDate: z.boolean().optional(),
    showLocation: z.boolean().optional(),
  }).optional(),
  displaySettings: z.object({
    dateFormat: z.string().optional(),
    timeFormat: z.enum(["12h", "24h"]).optional(),
    currency: z.string().optional(),
  }).optional(),
});

const profileUpdateSchema = z.object({
  bio: z.string().max(500).optional().or(z.literal("")),
  phoneNumber: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().datetime().optional().or(z.literal("")),
  location: z.string().max(100).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  socialLinks: socialLinksSchema.optional(),
  preferences: userPreferencesSchema.optional(),
});

// Get Profile Action
export const getProfileAction = authAction.action(async ({ ctx }) => {
  const profileService = UserProfileService.getInstance();
  const profile = await profileService.getProfile(ctx.user.id);

  if (!profile) {
    throw new Error("Profile not found");
  }

  return {
    success: true,
    profile: profile.toJSON(),
  };
});

// Update Profile Action
export const updateProfileAction = authAction
  .schema(profileUpdateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    // Process date of birth
    const updateData: any = { ...parsedInput };
    if (parsedInput.dateOfBirth && parsedInput.dateOfBirth !== "") {
      updateData.dateOfBirth = new Date(parsedInput.dateOfBirth);
    } else if (parsedInput.dateOfBirth === "") {
      updateData.dateOfBirth = null;
    }

    // Clean up empty strings
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === "") {
        updateData[key] = null;
      }
    });

    const result = await profileService.updateProfile(
      ctx.user.id,
      updateData,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to update profile");
    }

    // Revalidate profile pages
    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return {
      success: true,
      profile: result.profile?.toJSON(),
      warnings: result.warnings,
      message: "Profile updated successfully!",
    };
  });

// Upload Avatar Action (preparation step)
export const prepareAvatarUploadAction = authAction
  .schema(
    z.object({
      fileName: z.string().min(1, "File name is required"),
      fileSize: z.number().positive("File size must be positive"),
      fileType: z.string().min(1, "File type is required"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const profileService = UserProfileService.getInstance();

    const result = await profileService.prepareAvatarUpload(ctx.user.id, {
      name: parsedInput.fileName,
      size: parsedInput.fileSize,
      type: parsedInput.fileType,
    });

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to prepare avatar upload");
    }

    return {
      success: true,
      uploadUrl: result.uploadUrl,
      message: "Avatar upload prepared successfully",
    };
  });

// Update Avatar Action (after upload)
export const updateAvatarAction = authAction
  .schema(
    z.object({
      avatarUrl: z.string().url("Invalid avatar URL"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    const result = await profileService.updateAvatar(
      ctx.user.id,
      parsedInput.avatarUrl,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to update avatar");
    }

    // Revalidate profile pages
    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return {
      success: true,
      avatarUrl: result.avatarUrl,
      message: "Avatar updated successfully!",
    };
  });

// Delete Avatar Action
export const deleteAvatarAction = authAction.action(async ({ ctx }) => {
  const { userAgent, ipAddress } = await getClientInfo();
  const profileService = UserProfileService.getInstance();

  const result = await profileService.deleteAvatar(
    ctx.user.id,
    { ipAddress, userAgent }
  );

  if (!result.success) {
    throw new Error(result.errors?.[0] || "Failed to delete avatar");
  }

  // Revalidate profile pages
  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return {
    success: true,
    profile: result.profile?.toJSON(),
    message: "Avatar deleted successfully!",
  };
});

// Update Social Links Action
export const updateSocialLinksAction = authAction
  .schema(socialLinksSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    // Clean up empty strings from social links
    const socialLinks: SocialLinks = {};
    Object.entries(parsedInput).forEach(([key, value]) => {
      if (value && value !== "") {
        socialLinks[key] = value;
      }
    });

    const result = await profileService.updateSocialLinks(
      ctx.user.id,
      socialLinks,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to update social links");
    }

    // Revalidate profile pages
    revalidatePath("/profile");

    return {
      success: true,
      profile: result.profile?.toJSON(),
      message: "Social links updated successfully!",
    };
  });

// Add Social Link Action
export const addSocialLinkAction = authAction
  .schema(
    z.object({
      platform: z.string().min(1, "Platform is required"),
      url: z.string().url("Invalid URL"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    const result = await profileService.addSocialLink(
      ctx.user.id,
      parsedInput.platform,
      parsedInput.url,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to add social link");
    }

    // Revalidate profile pages
    revalidatePath("/profile");

    return {
      success: true,
      profile: result.profile?.toJSON(),
      message: `${parsedInput.platform} link added successfully!`,
    };
  });

// Remove Social Link Action
export const removeSocialLinkAction = authAction
  .schema(
    z.object({
      platform: z.string().min(1, "Platform is required"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    const result = await profileService.removeSocialLink(
      ctx.user.id,
      parsedInput.platform,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to remove social link");
    }

    // Revalidate profile pages
    revalidatePath("/profile");

    return {
      success: true,
      profile: result.profile?.toJSON(),
      message: `${parsedInput.platform} link removed successfully!`,
    };
  });

// Update Preferences Action
export const updatePreferencesAction = authAction
  .schema(userPreferencesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    const result = await profileService.updatePreferences(
      ctx.user.id,
      parsedInput as UserPreferences,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to update preferences");
    }

    // Revalidate relevant pages
    revalidatePath("/profile");
    revalidatePath("/settings");

    return {
      success: true,
      profile: result.profile?.toJSON(),
      message: "Preferences updated successfully!",
    };
  });

// Link OAuth Account Action
export const linkOAuthAccountAction = authAction
  .schema(
    z.object({
      provider: z.string().min(1, "Provider is required"),
      providerId: z.string().min(1, "Provider ID is required"),
      providerEmail: z.string().email().optional(),
      displayName: z.string().optional(),
      profileUrl: z.string().url().optional(),
      avatarUrl: z.string().url().optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
      scope: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    // Process expiration date
    const accountData: any = { ...parsedInput };
    if (parsedInput.expiresAt) {
      accountData.expiresAt = new Date(parsedInput.expiresAt);
    }

    const result = await profileService.linkAccount(
      ctx.user.id,
      accountData,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to link account");
    }

    // Revalidate profile pages
    revalidatePath("/profile");
    revalidatePath("/profile/security");

    return {
      success: true,
      linkedAccount: result.linkedAccount,
      message: `${parsedInput.provider} account linked successfully!`,
    };
  });

// Unlink OAuth Account Action
export const unlinkOAuthAccountAction = authAction
  .schema(
    z.object({
      provider: z.string().min(1, "Provider is required"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const { userAgent, ipAddress } = await getClientInfo();
    const profileService = UserProfileService.getInstance();

    const result = await profileService.unlinkAccount(
      ctx.user.id,
      parsedInput.provider,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      throw new Error(result.errors?.[0] || "Failed to unlink account");
    }

    // Revalidate profile pages
    revalidatePath("/profile");
    revalidatePath("/profile/security");

    return {
      success: true,
      message: `${parsedInput.provider} account unlinked successfully!`,
    };
  });

// Get Profile Stats Action
export const getProfileStatsAction = authAction.action(async ({ ctx }) => {
  const profileService = UserProfileService.getInstance();
  const stats = await profileService.getProfileStats(ctx.user.id);

  if (!stats) {
    throw new Error("Failed to retrieve profile statistics");
  }

  return {
    success: true,
    stats,
  };
});

// Validate Profile Field Action (for real-time validation)
export const validateProfileFieldAction = authAction
  .schema(
    z.object({
      field: z.enum([
        "bio",
        "phoneNumber",
        "website",
        "location",
        "dateOfBirth",
      ]),
      value: z.string(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const errors: string[] = [];

    switch (parsedInput.field) {
      case "bio":
        if (parsedInput.value.length > 500) {
          errors.push("Bio must be 500 characters or less");
        }
        break;

      case "phoneNumber":
        if (parsedInput.value) {
          const phoneRegex = /^\+?[1-9]\d{1,14}$/;
          if (!phoneRegex.test(parsedInput.value.replace(/[^\d+]/g, ""))) {
            errors.push("Invalid phone number format");
          }
        }
        break;

      case "website":
        if (parsedInput.value) {
          try {
            const url = new URL(parsedInput.value);
            if (!["http:", "https:"].includes(url.protocol)) {
              errors.push("Website must be a valid HTTP or HTTPS URL");
            }
          } catch {
            errors.push("Invalid website URL format");
          }
        }
        break;

      case "location":
        if (parsedInput.value.length > 100) {
          errors.push("Location must be 100 characters or less");
        }
        break;

      case "dateOfBirth":
        if (parsedInput.value) {
          try {
            const birthDate = new Date(parsedInput.value);
            const now = new Date();
            const age = now.getFullYear() - birthDate.getFullYear();
            
            if (age < 13) {
              errors.push("Must be at least 13 years old");
            }
            
            if (birthDate > now) {
              errors.push("Date of birth cannot be in the future");
            }
            
            if (age > 120) {
              errors.push("Invalid date of birth");
            }
          } catch {
            errors.push("Invalid date format");
          }
        }
        break;
    }

    return {
      success: errors.length === 0,
      errors,
      field: parsedInput.field,
      value: parsedInput.value,
    };
  });

// Calculate Profile Completeness Action
export const calculateProfileCompletenessAction = authAction.action(async ({ ctx }) => {
  const profileService = UserProfileService.getInstance();
  const profile = await profileService.getProfile(ctx.user.id);

  if (!profile) {
    throw new Error("Profile not found");
  }

  const completeness = profile.calculateProfileCompleteness();

  return {
    success: true,
    completeness,
    recommendations: [], // Will be generated by the service in getProfileStats
  };
});