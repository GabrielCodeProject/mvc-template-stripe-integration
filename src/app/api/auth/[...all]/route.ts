import { auth } from "@/lib/auth";

// Export the BetterAuth handler for all HTTP methods
export const GET = auth.handler;
export const POST = auth.handler;