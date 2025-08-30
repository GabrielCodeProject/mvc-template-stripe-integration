BetterAuth Integration with MVC Pattern + Server Actions & API Routes

Architecture Overview

┌──────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER │
│ │
│ ┌─────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│ │ Login Form │ │ Register Form │ │ User Profile │ │
│ │ (Server Action)│ │ (Server Action) │ │ (Server Action)│ │
│ └────────┬────────┘ └────────┬─────────┘ └────────┬───────┘ │
└───────────┼────────────────────┼──────────────────────┼─────────┘
│ │ │
▼ ▼ ▼
┌──────────────────────────────────────────────────────────────────┐
│ SERVER ACTIONS LAYER │
│ (Internal Forms & User Interactions) │
│ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ src/actions/auth.actions.ts │ │
│ │ • loginAction() • registerAction() │ │
│ │ • logoutAction() • updateProfileAction() │ │
│ │ • resetPasswordAction() • verify2FAAction() │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────┐
│ API ROUTES LAYER │
│ (External Integrations & Webhooks) │
│ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ /api/auth/[...all] - BetterAuth handler │ │
│ │ /api/webhooks/stripe - Stripe webhooks │ │
│ │ /api/oauth/callback - OAuth callbacks │ │
│ │ /api/integrations/\* - Third-party integrations │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER │
│ (Business Logic & Rules) │
│ │
│ ┌─────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│ │ AuthService │ │ SessionService │ │ TokenService │ │
│ │ • Validation │ │ • Management │ │ • JWT/Tokens │ │
│ │ • Business │ │ • Rotation │ │ • Refresh │ │
│ │ Rules │ │ • Invalidation │ │ • Validation │ │
│ └─────────────────┘ └──────────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────┐
│ REPOSITORY LAYER │
│ (Data Persistence) │
│ │
│ ┌─────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│ │AuthRepository │ │SessionRepository │ │AccountRepo │ │
│ └─────────────────┘ └──────────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────────────────────┘
│
▼
┌──────────────────────────────────────────────────────────────────┐
│ PRISMA DATABASE │
│ User | Account | Session Models │
└──────────────────────────────────────────────────────────────────┘

Classes & Methods Needed

1. Server Actions (Internal Operations)

// src/actions/auth.actions.ts
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

const action = createSafeActionClient();

// Login Server Action
export const loginAction = action
.schema(z.object({
email: z.string().email(),
password: z.string().min(8),
rememberMe: z.boolean().optional()
}))
.action(async ({ parsedInput }) => {
const authService = AuthService.getInstance();
const result = await authService.login(
parsedInput.email,
parsedInput.password,
parsedInput.rememberMe
);

      // Set cookie server-side
      cookies().set('session', result.session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: parsedInput.rememberMe ? 30 * 24 * 60 * 60 : undefined
      });

      return { user: result.user.toJSON() };
    });

// Register Server Action  
 export const registerAction = action
.schema(z.object({
email: z.string().email(),
password: z.string().min(8),
name: z.string().min(2),
acceptTerms: z.boolean()
}))
.action(async ({ parsedInput }) => {
const authService = AuthService.getInstance();
const user = await authService.register(parsedInput);

      // Send verification email
      await authService.sendVerificationEmail(user);

      return { success: true, requiresVerification: true };
    });

// Update Profile Server Action
export const updateProfileAction = action
.schema(z.object({
name: z.string().optional(),
phone: z.string().optional(),
timezone: z.string().optional(),
preferredCurrency: z.string().optional()
}))
.use(authMiddleware) // Custom middleware for auth
.action(async ({ parsedInput, ctx }) => {
const userService = UserService.getInstance();
const updated = await userService.updateUser(ctx.user.id, parsedInput);
revalidatePath('/profile');
return { user: updated.toJSON() };
});

// Enable 2FA Server Action
export const enable2FAAction = action
.use(authMiddleware)
.action(async ({ ctx }) => {
const authService = AuthService.getInstance();
const { secret, qrCode } = await authService.generateTwoFactorSecret(ctx.user.id);
return { secret, qrCode };
});

2. Auth Models

// src/models/AuthUser.ts
import { User } from "./User";
import bcrypt from "bcryptjs";

export class AuthUser extends User {
private \_passwordHash?: string;
private \_verificationToken?: string;
private \_resetToken?: string;
private \_twoFactorSecret?: string;
private \_backupCodes?: string[];

    // Password management
    public async setPassword(password: string): Promise<void> {
      this._passwordHash = await bcrypt.hash(password, 12);
      this._updatedAt = new Date();
    }

    public async verifyPassword(password: string): Promise<boolean> {
      if (!this._passwordHash) return false;
      return bcrypt.compare(password, this._passwordHash);
    }

    // Token management
    public generateVerificationToken(): string {
      this._verificationToken = crypto.randomUUID();
      return this._verificationToken;
    }

    public generateResetToken(): string {
      this._resetToken = crypto.randomUUID();
      return this._resetToken;
    }

    // 2FA management
    public enableTwoFactor(secret: string, backupCodes: string[]): void {
      this._twoFactorSecret = secret;
      this._backupCodes = backupCodes;
      this._twoFactorEnabled = true;
    }

    public validateTOTP(token: string): boolean {
      // Implement TOTP validation
      return true;
    }

}

// src/models/Session.ts
export class Session {
private \_id: string;
private \_userId: string;
private \_token: string;
private \_expiresAt: Date;
private \_ipAddress?: string;
private \_userAgent?: string;
private \_isActive: boolean;

    public isValid(): boolean {
      return this._isActive && this._expiresAt > new Date();
    }

    public extend(hours: number = 24): void {
      this._expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    public revoke(): void {
      this._isActive = false;
    }

    public toJSON(): SessionJSON {
      return {
        id: this._id,
        userId: this._userId,
        expiresAt: this._expiresAt.toISOString(),
        ipAddress: this._ipAddress,
        userAgent: this._userAgent
      };
    }

}

3. Repository Layer

// src/repositories/AuthRepository.ts
import { PrismaClient } from '@prisma/client';
import { AuthUser } from '@/models/AuthUser';

export class AuthRepository {
private prisma: PrismaClient;
private static instance: AuthRepository;

    public static getInstance(): AuthRepository {
      if (!AuthRepository.instance) {
        AuthRepository.instance = new AuthRepository();
      }
      return AuthRepository.instance;
    }

    public async findByEmail(email: string): Promise<AuthUser | null> {
      const userData = await this.prisma.user.findUnique({
        where: { email },
        include: {
          accounts: true,
          sessions: true
        }
      });

      return userData ? AuthUser.fromPrismaModel(userData) : null;
    }

    public async createWithPassword(
      email: string,
      passwordHash: string,
      name: string
    ): Promise<AuthUser> {
      const userData = await this.prisma.user.create({
        data: {
          email,
          name,
          accounts: {
            create: {
              providerId: 'credentials',
              accountId: email,
              password: passwordHash
            }
          }
        },
        include: {
          accounts: true
        }
      });

      return AuthUser.fromPrismaModel(userData);
    }

    public async updateLastLogin(userId: string): Promise<void> {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      });
    }

}

// src/repositories/SessionRepository.ts  
 export class SessionRepository {
private prisma: PrismaClient;

    public async create(session: Session): Promise<Session> {
      const data = await this.prisma.session.create({
        data: {
          userId: session.userId,
          token: session.token,
          expiresAt: session.expiresAt,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent
        }
      });

      return Session.fromPrismaModel(data);
    }

    public async findByToken(token: string): Promise<Session | null> {
      const data = await this.prisma.session.findUnique({
        where: { token },
        include: { user: true }
      });

      return data ? Session.fromPrismaModel(data) : null;
    }

    public async invalidateUserSessions(userId: string): Promise<void> {
      await this.prisma.session.deleteMany({
        where: { userId }
      });
    }

    public async cleanupExpired(): Promise<number> {
      const result = await this.prisma.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });

      return result.count;
    }

}

4. Service Layer

// src/services/AuthService.ts
export class AuthService {
private authRepository: AuthRepository;
private sessionService: SessionService;
private emailService: EmailService;
private static instance: AuthService;

    public static getInstance(): AuthService {
      if (!AuthService.instance) {
        AuthService.instance = new AuthService();
      }
      return AuthService.instance;
    }

    public async register(data: RegisterInput): Promise<AuthUser> {
      // Check if user exists
      const existing = await this.authRepository.findByEmail(data.email);
      if (existing) {
        throw new Error('Email already registered');
      }

      // Create user with hashed password
      const user = new AuthUser({
        id: this.generateId(),
        email: data.email,
        name: data.name
      });

      await user.setPassword(data.password);
      const saved = await this.authRepository.createWithPassword(
        user.email,
        user.passwordHash,
        user.name
      );

      // Generate verification token
      const token = saved.generateVerificationToken();
      await this.authRepository.saveVerificationToken(saved.id, token);

      return saved;
    }

    public async login(
      email: string,
      password: string,
      rememberMe?: boolean
    ): Promise<{ user: AuthUser; session: Session }> {
      // Find user
      const user = await this.authRepository.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const valid = await user.verifyPassword(password);
      if (!valid) {
        throw new Error('Invalid credentials');
      }

      // Check if email verified
      if (!user.emailVerified) {
        throw new Error('Please verify your email first');
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        // Return partial session for 2FA flow
        return { user, session: null, requires2FA: true };
      }

      // Create session
      const session = await this.sessionService.createSession(
        user.id,
        rememberMe ? 30 * 24 : 24 // hours
      );

      // Update last login
      await this.authRepository.updateLastLogin(user.id);

      return { user, session };
    }

    public async logout(sessionToken: string): Promise<void> {
      await this.sessionService.revokeSession(sessionToken);
    }

    public async verifyEmail(token: string): Promise<boolean> {
      const user = await this.authRepository.findByVerificationToken(token);
      if (!user) {
        throw new Error('Invalid verification token');
      }

      user.emailVerified = true;
      await this.authRepository.update(user.id, user);

      return true;
    }

    public async initiatePasswordReset(email: string): Promise<void> {
      const user = await this.authRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return;
      }

      const resetToken = user.generateResetToken();
      await this.authRepository.saveResetToken(user.id, resetToken);

      // Send reset email
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    }

    public async resetPassword(token: string, newPassword: string): Promise<void> {
      const user = await this.authRepository.findByResetToken(token);
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      await user.setPassword(newPassword);
      await this.authRepository.updatePassword(user.id, user.passwordHash);

      // Invalidate all sessions
      await this.sessionService.revokeAllUserSessions(user.id);
    }

}

5. API Routes (External Integrations)

// src/app/api/auth/[...all]/route.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// BetterAuth configuration for OAuth and external auth
export const auth = betterAuth({
database: prismaAdapter(prisma, {
provider: "postgresql"
}),
emailAndPassword: {
enabled: false, // We handle this via server actions
},
socialProviders: {
google: {
clientId: process.env.GOOGLE_CLIENT_ID!,
clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
},
github: {
clientId: process.env.GITHUB_CLIENT_ID!,
clientSecret: process.env.GITHUB_CLIENT_SECRET!,
}
},
callbacks: {
session: async ({ session, user }) => {
// Sync with our session service
const sessionService = SessionService.getInstance();
await sessionService.syncExternalSession(session);
return session;
}
}
});

export const { GET, POST } = auth.handlers;

// src/app/api/webhooks/stripe/route.ts
export async function POST(request: Request) {
const signature = request.headers.get('stripe-signature')!;
const body = await request.text();

    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      const webhookService = WebhookService.getInstance();
      await webhookService.handleStripeEvent(event);

      return NextResponse.json({ received: true });
    } catch (error) {
      return NextResponse.json(
        { error: 'Webhook handler failed' },
        { status: 400 }
      );
    }

}

// src/app/api/integrations/slack/route.ts
export async function POST(request: Request) {
const authService = AuthService.getInstance();
const session = await authService.validateApiKey(
request.headers.get('x-api-key')
);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integrationService = IntegrationService.getInstance();
    const result = await integrationService.handleSlackWebhook(
      await request.json(),
      session.userId
    );

    return NextResponse.json(result);

}

6. Middleware for Auth

// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
const sessionToken = request.cookies.get('session')?.value;

    // Protected routes
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      if (!sessionToken) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Validate session via service
      const sessionService = SessionService.getInstance();
      const session = await sessionService.validateSession(sessionToken);

      if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Add user to headers for server components
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', session.userId);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.next();

}

export const config = {
matcher: ['/dashboard/:path*', '/api/protected/:path*']
};

Potential Drawbacks & Solutions

1. Complexity Management

- Drawback: Two auth systems (Server Actions + BetterAuth) increase complexity
- Solution: Clear separation - Server Actions for forms, BetterAuth for OAuth only

2. Session Consistency

- Drawback: Sessions managed in multiple places (cookies, database, BetterAuth)
- Solution: Single source of truth in SessionService, sync external sessions

3. Type Safety Across Boundaries

- Drawback: Types need consistency across server actions, API routes, and client
- Solution: Shared type definitions, Zod schemas for validation

4. Performance Overhead

- Drawback: Multiple layers add latency
- Solution: Strategic caching, connection pooling, optimized queries

5. Error Handling Complexity

- Drawback: Errors from different layers need consistent handling
- Solution: Centralized error handler, custom error classes

Benefits of This Approach

1. Progressive Enhancement

- Forms work without JavaScript using server actions
- Graceful degradation for older browsers
- Better SEO and accessibility

2. Security

- Server actions prevent CSRF by default
- API routes handle external auth securely
- Sensitive operations stay server-side

3. Performance

- Server actions reduce client bundle size
- Direct database access without API overhead
- Optimistic UI updates with server actions

4. Developer Experience

- Type-safe from database to UI
- Clear separation of concerns
- Easy testing with dependency injection

5. Scalability

- Can split auth service into microservice
- Easy to add new auth providers
- Clean integration points for new features

●User approved Claude's plan:
⎿ BetterAuth + MVC Implementation Plan with Server Actions & API Routes

     Phase 1: Core Setup

     1. Install dependencies:
       - better-auth, @better-auth/prisma-adapter
       - bcryptjs for password hashing
       - zod for validation
       - speakeasy for 2FA/TOTP
     2. Update Prisma schema if needed for auth fields

     Phase 2: Model Layer

     1. Create AuthUser model extending User with password/token methods
     2. Create Session model with validation and expiry logic
     3. Add type definitions for auth-related data

     Phase 3: Repository Layer

     1. Create AuthRepository for user auth operations
     2. Create SessionRepository for session management
     3. Create AccountRepository for OAuth accounts
     4. Integrate with Prisma for database operations

     Phase 4: Service Layer

     1. Create AuthService for authentication logic
     2. Create SessionService for session management
     3. Create TokenService for JWT/token handling
     4. Create EmailService for auth emails

     Phase 5: Server Actions (Internal Forms)

     1. Create auth.actions.ts with:
       - loginAction, registerAction, logoutAction
       - updateProfileAction, changePasswordAction
       - enable2FAAction, verify2FAAction
       - resetPasswordAction
     2. Add validation with Zod schemas
     3. Implement with next-safe-action

     Phase 6: API Routes (External)

     1. Setup /api/auth/[...all] for BetterAuth OAuth
     2. Create /api/webhooks/stripe for payment events
     3. Add /api/integrations/* for third-party services
     4. Implement API key authentication for external access

     Phase 7: Client Integration

     1. Create auth forms using server actions
     2. Add AuthProvider context
     3. Implement protected routes
     4. Add progressive enhancement

     Phase 8: Middleware & Security

     1. Create auth middleware for protected routes
     2. Add CSRF protection
     3. Implement rate limiting
     4. Setup security headers

     Phase 9: Testing & Validation

     1. Test auth flows end-to-end
     2. Verify session management
     3. Test OAuth providers
     4. Validate progressive enhancement
