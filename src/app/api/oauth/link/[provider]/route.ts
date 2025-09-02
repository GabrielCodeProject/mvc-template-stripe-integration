import { NextRequest, NextResponse } from 'next/server';
import { OAuthIntegrationService } from '@/services/OAuthIntegrationService';
import { AuthService } from '@/services/AuthService';
import { SecurityAuditLogService } from '@/services/SecurityAuditLogService';
import { SecurityAction } from '@/models/SecurityAuditLog';

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 
         request.headers.get('x-real-ip') || 
         request.headers.get('remote-addr') || 
         'unknown';
}

// GET /api/oauth/link/[provider] - Initiate OAuth linking flow
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { provider } = await params;
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Authenticate user
    const authService = AuthService.getInstance();
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await authService.getUserBySession(sessionCookie);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if provider is supported
    const oauthService = OAuthIntegrationService.getInstance();
    if (!oauthService.isProviderConfigured(provider)) {
      await SecurityAuditLogService.getInstance().logSecurityEvent(
        SecurityAction.OAUTH_LINK,
        {
          userId: user.id,
          ipAddress,
          userAgent,
          eventData: {
            provider,
            error: 'Unsupported or unconfigured provider',
          },
        }
      );

      return NextResponse.json(
        { error: 'OAuth provider not supported or configured' },
        { status: 400 }
      );
    }

    // Generate authorization URL
    const result = oauthService.generateAuthUrl(provider, user.id);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Log OAuth initiation
    await SecurityAuditLogService.getInstance().logUserManagementEvent(
      SecurityAction.OAUTH_LINK_INITIATED,
      {
        userId: user.id,
        ipAddress,
        userAgent,
        resource: `oauth:${provider}`,
        eventData: { provider },
      }
    );

    return NextResponse.json({
      success: true,
      authUrl: result.authUrl,
      provider,
    });

  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/oauth/link/[provider] - Complete OAuth linking (callback handler)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { provider } = await params;
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Parse request body
    const { code, state, error: oauthError } = await request.json();

    // Check for OAuth errors
    if (oauthError) {
      await SecurityAuditLogService.getInstance().logSecurityEvent(
        SecurityAction.OAUTH_LINK,
        {
          ipAddress,
          userAgent,
          eventData: {
            provider,
            oauthError,
          },
        }
      );

      return NextResponse.json(
        { 
          error: 'OAuth authorization failed',
          details: oauthError 
        },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state parameter' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authService = AuthService.getInstance();
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await authService.getUserBySession(sessionCookie);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Link the OAuth account
    const oauthService = OAuthIntegrationService.getInstance();
    const linkResult = await oauthService.linkAccount(
      user.id,
      provider,
      code,
      state,
      { ipAddress, userAgent }
    );

    if (!linkResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to link OAuth account',
          details: linkResult.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      linkedAccount: {
        provider: linkResult.linkedAccount?.provider,
        displayName: linkResult.linkedAccount?.displayName,
        providerEmail: linkResult.linkedAccount?.providerEmail,
        linkedAt: linkResult.linkedAccount?.linkedAt,
      },
      message: `Successfully linked ${provider} account`,
      warnings: linkResult.warnings,
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/oauth/link/[provider] - Unlink OAuth account
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { provider } = await params;
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Authenticate user
    const authService = AuthService.getInstance();
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await authService.getUserBySession(sessionCookie);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Unlink the account using the profile service (which handles audit logging)
    const { UserProfileService } = await import('@/services/UserProfileService');
    const profileService = UserProfileService.getInstance();
    
    const result = await profileService.unlinkAccount(
      user.id,
      provider,
      { ipAddress, userAgent }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to unlink account',
          details: result.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully unlinked ${provider} account`,
    });

  } catch (error) {
    console.error('OAuth unlink error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}