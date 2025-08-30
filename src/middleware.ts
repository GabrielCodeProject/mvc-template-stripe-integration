import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/settings',
  '/api/protected'
];

// Define auth routes (redirect to dashboard if already authenticated)
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password'
];

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/about',
  '/contact',
  '/api/auth', // BetterAuth routes
  '/api/webhooks', // Webhook routes
  '/verify-email'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;
  
  // Check if current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Check if current path is an auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // Check if current path is a public route
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route) || pathname === route
  );
  
  // Handle protected routes
  if (isProtectedRoute) {
    if (!sessionToken) {
      // Redirect to login if no session
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Validate session (simplified - in production, validate against database)
    const sessionValid = await validateSession(sessionToken);
    
    if (!sessionValid) {
      // Clear invalid session and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
    
    // Get user info for protected routes
    const user = await getUserFromSession(sessionToken);
    if (user) {
      // Add user info to headers for server components
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email);
      requestHeaders.set('x-user-role', user.role || 'CUSTOMER');
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }
  
  // Handle auth routes when already authenticated
  if (isAuthRoute && sessionToken) {
    const sessionValid = await validateSession(sessionToken);
    
    if (sessionValid) {
      // Redirect to dashboard if already authenticated
      const redirectUrl = request.nextUrl.searchParams.get('from') || '/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    } else {
      // Clear invalid session
      const response = NextResponse.next();
      response.cookies.delete('session');
      return response;
    }
  }
  
  // Handle API routes that need authentication
  if (pathname.startsWith('/api/protected/')) {
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const sessionValid = await validateSession(sessionToken);
    if (!sessionValid) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    // Add user info to headers for API routes
    const user = await getUserFromSession(sessionToken);
    if (user) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email);
      requestHeaders.set('x-user-role', user.role || 'CUSTOMER');
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }
  
  // Handle 2FA routes
  if (pathname.startsWith('/2fa')) {
    const twoFactorToken = request.cookies.get('2fa-token')?.value;
    
    if (!twoFactorToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Validate 2FA token (simplified validation)
    const is2FATokenValid = twoFactorToken.length > 0;
    if (!is2FATokenValid) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('2fa-token');
      return response;
    }
  }
  
  // Add security headers to all responses
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSRF protection for POST requests
  if (request.method === 'POST' && !pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }
  }
  
  // Rate limiting for auth endpoints
  if (pathname.startsWith('/api/auth/') || isAuthRoute) {
    const rateLimitResult = await applyRateLimit(request);
    if (rateLimitResult.blocked) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
  }
  
  return response;
}

// Validate session (simplified - in production, check against database)
async function validateSession(sessionToken: string): Promise<boolean> {
  try {
    // In production, validate against SessionRepository
    // const { SessionService } = await import("@/services/SessionService");
    // const sessionService = SessionService.getInstance();
    // const session = await sessionService.validateSession(sessionToken);
    // return !!session;
    
    // For demo purposes, just check if token exists and is not empty
    return sessionToken.length > 0;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

// Get user from session
async function getUserFromSession(sessionToken: string): Promise<{
  id: string;
  email: string;
  role: string;
} | null> {
  try {
    // In production, get user from SessionService
    // const { AuthService } = await import("@/services/AuthService");
    // const authService = AuthService.getInstance();
    // const user = await authService.getUserBySession(sessionToken);
    // return user ? { id: user.id, email: user.email, role: user.role } : null;
    
    // For demo purposes, return mock user data
    return {
      id: 'demo-user-id',
      email: 'demo@example.com',
      role: 'CUSTOMER'
    };
  } catch (error) {
    console.error('Get user from session error:', error);
    return null;
  }
}

// Simple rate limiting implementation
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

async function applyRateLimit(request: NextRequest): Promise<{ blocked: boolean }> {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10; // Max 10 requests per minute
  
  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or initialize rate limit
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return { blocked: false };
  }
  
  if (current.count >= maxRequests) {
    return { blocked: true };
  }
  
  // Increment count
  rateLimitMap.set(key, {
    ...current,
    count: current.count + 1
  });
  
  return { blocked: false };
}

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};