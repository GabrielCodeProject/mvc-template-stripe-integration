import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProfileManager from "@/components/auth/profile/ProfileManager";
import { AuthUser } from "@/models/AuthUser";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Convert session user to AuthUser format expected by ProfileManager
  const sessionUser = session.user as any;
  const authUser = new AuthUser({
    id: sessionUser.id,
    name: sessionUser.name || "",
    email: sessionUser.email || "",
    image: sessionUser.image || undefined,
    emailVerified: sessionUser.emailVerified || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Management</h1>
          <p className="text-gray-600 mt-2">
            Manage your profile information, security settings, and account preferences.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <ProfileManager 
            user={authUser} 
            initialTab={searchParams.tab}
            className="border-0 shadow-none"
          />
        </div>
      </div>
    </div>
  );
}