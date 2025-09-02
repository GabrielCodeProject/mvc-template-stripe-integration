"use client";

import { useState } from "react";
import Link from "next/link";
import { User, Settings, LogOut, UserCircle, Shield, Activity } from "lucide-react";

interface DashboardContentProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {user.image ? (
              <img
                src={user.image}
                alt="Profile"
                className="w-12 h-12 rounded-full border-2 border-gray-200"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {user.name || "User"}!
            </h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Profile Management */}
        <Link href="/profile" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Profile Management
                </h3>
                <p className="text-gray-600 text-sm">
                  Update your profile, avatar, and social links
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Account Settings */}
        <Link href="/profile?tab=settings" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Settings className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  Account Settings
                </h3>
                <p className="text-gray-600 text-sm">
                  Security settings, privacy, and preferences
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Security Center */}
        <Link href="/profile?tab=security" className="group">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                  Security Center
                </h3>
                <p className="text-gray-600 text-sm">
                  Two-factor auth, audit logs, and security
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Activity className="w-6 h-6 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="text-gray-600">
          <p>Welcome to your dashboard! Start by updating your profile or exploring account settings.</p>
        </div>
      </div>
    </div>
  );
}