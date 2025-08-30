import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL!,
  },

  // Disable email/password since we handle it via server actions
  emailAndPassword: {
    enabled: false,
  },

  // Social providers for OAuth
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/github`,
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Security settings
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    useSecureCookies: process.env.NODE_ENV === "production",
    generateId: () => {
      return crypto.randomUUID();
    },
  },

  // Callbacks for integration with our MVC system
  callbacks: {
    session: {
      jwt: async ({ session, user }: { session: any; user: any }) => {
        // Sync external OAuth session with our internal session system
        try {
          const { SessionService } = await import("@/services/SessionService");
          const sessionService = SessionService.getInstance();

          await sessionService.syncExternalSession({
            userId: user.id,
            sessionToken: session.token,
            expires: session.expiresAt,
            createdAt: session.createdAt,
          });

          return session;
        } catch (error) {
          console.error("Failed to sync external session:", error);
          return session;
        }
      },
    },

    signIn: {
      before: async ({ user, account }: { user: any; account: any }) => {
        // Check if user should be allowed to sign in
        if (!user.emailVerified && account.providerId !== "credentials") {
          // OAuth providers are considered verified
          return {
            user: { ...user, emailVerified: true },
          };
        }
        return { user };
      },

      after: async ({
        user,
        session,
        account,
        isNewUser,
      }: {
        user: any;
        session: any;
        account: any;
        isNewUser: boolean;
      }) => {
        try {
          const { AuthRepository } = await import(
            "@/repositories/AuthRepository"
          );
          const authRepo = AuthRepository.getInstance();

          if (isNewUser && account.providerId !== "credentials") {
            // Create OAuth user in our system
            await authRepo.createWithOAuth(
              user.email,
              user.name || user.email.split("@")[0],
              account.providerId,
              account.providerAccountId,
              account.accessToken,
              account.refreshToken
            );
          }

          // Update last login
          await authRepo.updateLastLogin(user.id);
        } catch (error) {
          console.error("Failed to sync OAuth user:", error);
        }
      },
    },
  },

  // Plugins and extensions
  plugins: [
    // You can add BetterAuth plugins here
  ],

  // Rate limiting
  rateLimit: {
    window: 60, // 60 seconds
    max: 100, // 100 requests per window
  },

  // CSRF protection
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    process.env.NEXTAUTH_URL!,
  ].filter(Boolean),

  // Base URL
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000",
  basePath: "/api/auth",
});

// Export types for client-side usage would go here
// For now, we'll use our own User and Session models
