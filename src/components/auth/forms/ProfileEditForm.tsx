"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/models/User";
import { UserProfile, SocialLinks } from "@/models/UserProfile";
import {
  updateProfileAction,
  validateProfileFieldAction,
  addSocialLinkAction,
  removeSocialLinkAction,
} from "@/actions/profile.actions";

// Component props interface
export interface ProfileEditFormProps {
  user: User;
  profile: UserProfile;
  onUpdate?: (profile: UserProfile) => void;
  onCancel?: () => void;
  className?: string;
}

// Form data interfaces
interface ProfileFormData {
  firstName: string;
  lastName: string;
  bio: string;
  phoneNumber: string;
  dateOfBirth: string;
  location: string;
  website: string;
  language: string;
  timezone: string;
  gender: string;
}

interface SocialLinkFormData {
  platform: string;
  url: string;
}

interface ValidationState {
  [key: string]: {
    isValid: boolean;
    error?: string;
    isValidating?: boolean;
  };
}

interface LoadingStates {
  [key: string]: boolean;
}

// Social platform configurations
const SOCIAL_PLATFORMS = [
  { key: "twitter", name: "Twitter", icon: "𝕏", pattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+$/ },
  { key: "linkedin", name: "LinkedIn", icon: "💼", pattern: /^https?:\/\/(www\.)?linkedin\.com\/in\/.+$/ },
  { key: "github", name: "GitHub", icon: "🐙", pattern: /^https?:\/\/(www\.)?github\.com\/.+$/ },
  { key: "facebook", name: "Facebook", icon: "👥", pattern: /^https?:\/\/(www\.)?facebook\.com\/.+$/ },
  { key: "instagram", name: "Instagram", icon: "📸", pattern: /^https?:\/\/(www\.)?instagram\.com\/.+$/ },
  { key: "youtube", name: "YouTube", icon: "📺", pattern: /^https?:\/\/(www\.)?youtube\.com\/.+$/ },
] as const;

// Language and timezone options
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const GENDERS = [
  { value: "", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];

export default function ProfileEditForm({
  user,
  profile,
  onUpdate,
  onCancel,
  className = "",
}: ProfileEditFormProps) {
  // Split name for display
  const nameParts = user.name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Form state
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName,
    lastName,
    bio: profile.bio || "",
    phoneNumber: profile.phoneNumber || "",
    dateOfBirth: profile.dateOfBirth?.toISOString().split("T")[0] || "",
    location: profile.location || "",
    website: profile.website || "",
    language: profile.preferences?.language || "en",
    timezone: profile.preferences?.timezone || "America/New_York",
    gender: "", // This would come from extended profile data
  });

  const [socialLinks, setSocialLinks] = useState<SocialLinks>(profile.socialLinks || {});
  const [newSocialLink, setNewSocialLink] = useState<SocialLinkFormData>({
    platform: "twitter",
    url: "",
  });

  const [validation, setValidation] = useState<ValidationState>({});
  const [loading, setLoading] = useState<LoadingStates>({});
  const [isDirty, setIsDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("basic");

  // Debounced validation
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const validateField = useCallback(
    async (field: string, value: string) => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      setValidation((prev) => ({
        ...prev,
        [field]: { ...prev[field], isValidating: true },
      }));

      debounceTimeout.current = setTimeout(async () => {
        try {
          if (["bio", "phoneNumber", "website", "location", "dateOfBirth"].includes(field)) {
            const result = await validateProfileFieldAction({
              field: field as any,
              value,
            });

            setValidation((prev) => ({
              ...prev,
              [field]: {
                isValid: result?.data?.success || false,
                error: result?.data?.errors?.[0],
                isValidating: false,
              },
            }));
          } else {
            // Client-side validation for other fields
            let isValid = true;
            let error: string | undefined;

            switch (field) {
              case "firstName":
              case "lastName":
                isValid = value.length >= 1;
                error = isValid ? undefined : `${field === "firstName" ? "First" : "Last"} name is required`;
                break;
              case "website":
                if (value) {
                  try {
                    new URL(value);
                  } catch {
                    isValid = false;
                    error = "Please enter a valid URL";
                  }
                }
                break;
            }

            setValidation((prev) => ({
              ...prev,
              [field]: { isValid, error, isValidating: false },
            }));
          }
        } catch {
          setValidation((prev) => ({
            ...prev,
            [field]: {
              isValid: false,
              error: "Validation error occurred",
              isValidating: false,
            },
          }));
        }
      }, 500);
    },
    []
  );

  // Handle form field changes
  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    validateField(field, value);
  };

  // Handle social link validation
  const validateSocialUrl = (platform: string, url: string): { isValid: boolean; error?: string } => {
    if (!url) return { isValid: false, error: "URL is required" };

    try {
      new URL(url);
    } catch {
      return { isValid: false, error: "Please enter a valid URL" };
    }

    const platformConfig = SOCIAL_PLATFORMS.find((p) => p.key === platform);
    if (platformConfig && !platformConfig.pattern.test(url)) {
      return {
        isValid: false,
        error: `Please enter a valid ${platformConfig.name} URL`,
      };
    }

    return { isValid: true };
  };

  // Add social link
  const handleAddSocialLink = async () => {
    const validation = validateSocialUrl(newSocialLink.platform, newSocialLink.url);
    if (!validation.isValid) {
      // Show error - you could implement a toast system here
      console.error(validation.error);
      return;
    }

    setLoading((prev) => ({ ...prev, addSocialLink: true }));

    try {
      const result = await addSocialLinkAction({
        platform: newSocialLink.platform,
        url: newSocialLink.url,
      });

      if (result?.data?.success && result.data.profile) {
        const updatedProfile = UserProfile.fromJSON(result.data.profile);
        setSocialLinks(updatedProfile.socialLinks);
        setNewSocialLink({ platform: "twitter", url: "" });
        onUpdate?.(updatedProfile);
      }
    } catch (error) {
      console.error("Failed to add social link:", error);
    } finally {
      setLoading((prev) => ({ ...prev, addSocialLink: false }));
    }
  };

  // Remove social link
  const handleRemoveSocialLink = async (platform: string) => {
    setLoading((prev) => ({ ...prev, [`remove_${platform}`]: true }));

    try {
      const result = await removeSocialLinkAction({ platform });

      if (result?.data?.success && result.data.profile) {
        const updatedProfile = UserProfile.fromJSON(result.data.profile);
        setSocialLinks(updatedProfile.socialLinks);
        onUpdate?.(updatedProfile);
      }
    } catch (error) {
      console.error("Failed to remove social link:", error);
    } finally {
      setLoading((prev) => ({ ...prev, [`remove_${platform}`]: false }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const hasErrors = Object.values(validation).some((v) => !v.isValid);
    if (hasErrors) {
      console.error("Form has validation errors");
      return;
    }

    setLoading((prev) => ({ ...prev, submit: true }));

    try {
      const updateData: any = {
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
        location: formData.location,
        website: formData.website,
      };

      if (formData.dateOfBirth) {
        updateData.dateOfBirth = new Date(formData.dateOfBirth).toISOString();
      }

      // Update preferences
      updateData.preferences = {
        language: formData.language,
        timezone: formData.timezone,
      };

      const result = await updateProfileAction(updateData);

      if (result?.data?.success && result.data.profile) {
        const updatedProfile = UserProfile.fromJSON(result.data.profile);
        onUpdate?.(updatedProfile);
        setIsDirty(false);
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  // Character count helper
  const getCharacterCount = (text: string, limit: number) => ({
    count: text.length,
    remaining: limit - text.length,
    isOverLimit: text.length > limit,
  });

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Calculate bio character stats
  const bioStats = getCharacterCount(formData.bio, 500);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Edit Profile
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Update your personal information and preferences
        </p>
        {isDirty && (
          <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center">
            <span className="mr-1">⚠️</span>
            You have unsaved changes
          </div>
        )}
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: "basic", label: "Basic Info" },
            { id: "contact", label: "Contact" },
            { id: "personal", label: "Personal" },
            { id: "social", label: "Social Links" },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeSection === section.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        {activeSection === "basic" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleFieldChange("firstName", e.target.value)}
                  disabled={loading.submit}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    validation.firstName?.error
                      ? "border-red-500 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="John"
                />
                {validation.firstName?.error && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {validation.firstName.error}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleFieldChange("lastName", e.target.value)}
                  disabled={loading.submit}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    validation.lastName?.error
                      ? "border-red-500 dark:border-red-400"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="Doe"
                />
                {validation.lastName?.error && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {validation.lastName.error}
                  </p>
                )}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Bio
                <span className="text-gray-500 ml-1">(Optional)</span>
              </label>
              <textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleFieldChange("bio", e.target.value)}
                disabled={loading.submit}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-none ${
                  validation.bio?.error || bioStats.isOverLimit
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="Tell us about yourself..."
              />
              <div className="mt-1 flex justify-between items-center">
                {validation.bio?.isValidating ? (
                  <span className="text-sm text-gray-500">Validating...</span>
                ) : validation.bio?.error ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {validation.bio.error}
                  </p>
                ) : (
                  <div />
                )}
                <span
                  className={`text-sm ${
                    bioStats.isOverLimit
                      ? "text-red-600 dark:text-red-400"
                      : bioStats.remaining < 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {bioStats.count}/500
                </span>
              </div>
            </div>

            {/* Location */}
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Location
                <span className="text-gray-500 ml-1">(Optional)</span>
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleFieldChange("location", e.target.value)}
                disabled={loading.submit}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  validation.location?.error
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="New York, NY"
              />
              {validation.location?.error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validation.location.error}
                </p>
              )}
            </div>

            {/* Website */}
            <div>
              <label
                htmlFor="website"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Website
                <span className="text-gray-500 ml-1">(Optional)</span>
              </label>
              <input
                type="url"
                id="website"
                value={formData.website}
                onChange={(e) => handleFieldChange("website", e.target.value)}
                disabled={loading.submit}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  validation.website?.error
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="https://yourwebsite.com"
              />
              {validation.website?.error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validation.website.error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Contact Information Section */}
        {activeSection === "contact" && (
          <div className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email cannot be changed here. Use account settings to update your email.
              </p>
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Phone Number
                <span className="text-gray-500 ml-1">(Optional)</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleFieldChange("phoneNumber", e.target.value)}
                disabled={loading.submit}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  validation.phoneNumber?.error
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="+1 (555) 123-4567"
              />
              {validation.phoneNumber?.error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validation.phoneNumber.error}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Include country code for international numbers
              </p>
            </div>
          </div>
        )}

        {/* Personal Details Section */}
        {activeSection === "personal" && (
          <div className="space-y-6">
            {/* Date of Birth */}
            <div>
              <label
                htmlFor="dateOfBirth"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Date of Birth
                <span className="text-gray-500 ml-1">(Optional)</span>
              </label>
              <input
                type="date"
                id="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={(e) => handleFieldChange("dateOfBirth", e.target.value)}
                disabled={loading.submit}
                max={new Date(Date.now() - 13 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  validation.dateOfBirth?.error
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
              {validation.dateOfBirth?.error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validation.dateOfBirth.error}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You must be at least 13 years old
              </p>
            </div>

            {/* Gender */}
            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Gender
                <span className="text-gray-500 ml-1">(Optional)</span>
              </label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => handleFieldChange("gender", e.target.value)}
                disabled={loading.submit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {GENDERS.map((gender) => (
                  <option key={gender.value} value={gender.value}>
                    {gender.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Preference */}
            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Preferred Language
              </label>
              <select
                id="language"
                value={formData.language}
                onChange={(e) => handleFieldChange("language", e.target.value)}
                disabled={loading.submit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Timezone
              </label>
              <select
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleFieldChange("timezone", e.target.value)}
                disabled={loading.submit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Social Links Section */}
        {activeSection === "social" && (
          <div className="space-y-6">
            {/* Existing Social Links */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Your Social Links
              </h3>
              <div className="space-y-3">
                {Object.entries(socialLinks).length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No social links added yet
                  </p>
                ) : (
                  Object.entries(socialLinks).map(([platform, url]) => {
                    const platformConfig = SOCIAL_PLATFORMS.find((p) => p.key === platform);
                    return (
                      <div
                        key={platform}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {platformConfig?.icon || "🔗"}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {platformConfig?.name || platform}
                            </p>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              {url}
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSocialLink(platform)}
                          disabled={loading[`remove_${platform}`]}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
                        >
                          {loading[`remove_${platform}`] ? "..." : "Remove"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Add New Social Link */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
                Add Social Link
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={newSocialLink.platform}
                  onChange={(e) =>
                    setNewSocialLink((prev) => ({ ...prev, platform: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  {SOCIAL_PLATFORMS.filter(
                    (platform) => !socialLinks[platform.key]
                  ).map((platform) => (
                    <option key={platform.key} value={platform.key}>
                      {platform.icon} {platform.name}
                    </option>
                  ))}
                </select>
                
                <input
                  type="url"
                  value={newSocialLink.url}
                  onChange={(e) =>
                    setNewSocialLink((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://..."
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                />
                
                <button
                  type="button"
                  onClick={handleAddSocialLink}
                  disabled={
                    !newSocialLink.url ||
                    loading.addSocialLink ||
                    SOCIAL_PLATFORMS.filter(p => !socialLinks[p.key]).length === 0
                  }
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading.addSocialLink ? "Adding..." : "Add Link"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading.submit}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            
            <div className="flex items-center space-x-4">
              {isDirty && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              )}
              <button
                type="submit"
                disabled={loading.submit || !isDirty}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading.submit && (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                <span>{loading.submit ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}