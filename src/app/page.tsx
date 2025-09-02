import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserManager from "@/components/userManager/UserManager";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If user is authenticated, redirect to dashboard
  if (session) {
    redirect("/dashboard");
  }

  // If not authenticated, show the UserManager (which seems to be a landing page)
  return <UserManager />;
}
