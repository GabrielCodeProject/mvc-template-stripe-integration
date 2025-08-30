"use client";

import SecuritySettings from "@/components/auth/profile/SecuritySettings";
import { AuthUser } from "@/models/AuthUser";

// Mock user data for testing
const mockUser = new AuthUser({
  id: "test-user-123",
  email: "test@example.com",
  name: "Test User",
  emailVerified: true,
  twoFactorEnabled: false,
  isActive: true,
  role: "USER",
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
  lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
});

export default function TestSecurityPage() {
  const handleSecurityChange = (event: { type: string; data?: unknown }) => {
    console.log("Security change:", event);
    // In a real implementation, this would update the user state
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Security Settings Test Page
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Testing the SecuritySettings dashboard component with mock data
          </p>
        </div>

        <SecuritySettings
          user={mockUser}
          onSecurityChange={handleSecurityChange}
          className="shadow-lg"
        />
      </div>
    </div>
  );
}