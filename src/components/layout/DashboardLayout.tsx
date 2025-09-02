"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  UserCircle,
  Shield,
  Activity
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home, current: pathname === "/dashboard" },
    { name: "Profile", href: "/profile", icon: User, current: pathname === "/profile" },
    { name: "Settings", href: "/profile?tab=settings", icon: Settings, current: pathname.includes("settings") },
    { name: "Security", href: "/profile?tab=security", icon: Shield, current: pathname.includes("security") },
  ];

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          },
          onError: (ctx) => {
            console.error("Logout error:", ctx.error);
            // Force redirect even on error
            window.location.href = "/login";
          },
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
      // Force redirect even on error
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    item.current
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`mr-3 h-5 w-5 ${item.current ? "text-blue-500" : "text-gray-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:bg-white lg:border-r lg:border-gray-200">
        <div className="flex h-16 shrink-0 items-center px-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  item.current
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${item.current ? "text-blue-500" : "text-gray-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-gray-600 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* User menu */}
            <div className="relative ml-auto">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 p-2"
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <span className="hidden sm:block text-gray-700 font-medium">
                  {user.name || "User"}
                </span>
              </button>

              {/* User dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.name || "User"}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4 mr-3" />
                    Profile
                  </Link>
                  <Link
                    href="/profile?tab=settings"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setUserMenuOpen(false)}
        />
      )}
    </div>
  );
}