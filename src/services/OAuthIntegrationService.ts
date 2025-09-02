import { UserProfileRepository, LinkedAccountData } from "@/repositories/UserProfileRepository";
import { SecurityAuditLogService } from "@/services/SecurityAuditLogService";
import { SecurityAction } from "@/models/SecurityAuditLog";
import { LinkedAccount } from "@/models/UserProfile";
import { prisma } from "@/lib/prisma";

export interface OAuthProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  avatar_url?: string;
  profile_url?: string;
  [key: string]: any;
}

export interface OAuthLinkResult {
  success: boolean;
  linkedAccount?: LinkedAccount;
  errors?: string[];
  warnings?: string[];
}

export class OAuthIntegrationService {
  private repository: UserProfileRepository;
  private auditService: SecurityAuditLogService;
  private static instance: OAuthIntegrationService;

  // OAuth provider configurations
  private providers: Map<string, OAuthProviderConfig> = new Map([
    ['google', {
      name: 'Google',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: ['openid', 'profile', 'email'],
      redirectUri: `${process.env.BETTER_AUTH_URL}/oauth-callback`,
    }],
    ['github', {
      name: 'GitHub',
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scope: ['user:email', 'read:user'],
      redirectUri: `${process.env.BETTER_AUTH_URL}/oauth-callback`,
    }],
    ['linkedin', {
      name: 'LinkedIn',
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      userInfoUrl: 'https://api.linkedin.com/v2/me',
      scope: ['r_liteprofile', 'r_emailaddress'],
      redirectUri: `${process.env.BETTER_AUTH_URL}/oauth-callback`,
    }],
    ['twitter', {
      name: 'Twitter',
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      userInfoUrl: 'https://api.twitter.com/2/users/me',
      scope: ['tweet.read', 'users.read'],
      redirectUri: `${process.env.BETTER_AUTH_URL}/oauth-callback`,
    }],
  ]);

  private constructor() {
    this.repository = UserProfileRepository.getInstance();
    this.auditService = SecurityAuditLogService.getInstance();
  }

  public static getInstance(): OAuthIntegrationService {
    if (!OAuthIntegrationService.instance) {
      OAuthIntegrationService.instance = new OAuthIntegrationService();
    }
    return OAuthIntegrationService.instance;
  }

  // Generate OAuth authorization URL
  public generateAuthUrl(
    provider: string,
    userId: string,
    state?: string
  ): { success: boolean; authUrl?: string; error?: string } {
    const config = this.providers.get(provider);
    if (!config) {
      return { success: false, error: 'Unknown OAuth provider' };
    }

    if (!config.clientId) {
      return { success: false, error: `${config.name} OAuth not configured` };
    }

    const stateParam = state || this.generateState(userId, provider);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      response_type: 'code',
      state: stateParam,
      access_type: 'offline', // for refresh tokens
      prompt: 'consent',
    });

    const authUrl = `${config.authUrl}?${params.toString()}`;

    return { success: true, authUrl };
  }

  // Exchange authorization code for access token
  public async exchangeCodeForToken(
    provider: string,
    code: string,
    state: string
  ): Promise<{
    success: boolean;
    tokenResponse?: OAuthTokenResponse;
    error?: string;
  }> {
    const config = this.providers.get(provider);
    if (!config) {
      return { success: false, error: 'Unknown OAuth provider' };
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        throw new Error(`OAuth token exchange failed: ${response.status}`);
      }

      const tokenResponse: OAuthTokenResponse = await response.json();
      
      return { success: true, tokenResponse };
    } catch (error) {
      console.error(`OAuth token exchange error for ${provider}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token exchange failed' 
      };
    }
  }

  // Get user information from OAuth provider
  public async getUserInfo(
    provider: string,
    accessToken: string
  ): Promise<{
    success: boolean;
    userInfo?: OAuthUserInfo;
    error?: string;
  }> {
    const config = this.providers.get(provider);
    if (!config) {
      return { success: false, error: 'Unknown OAuth provider' };
    }

    try {
      const response = await fetch(config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      let userInfo = await response.json();

      // Normalize user info across providers
      userInfo = this.normalizeUserInfo(provider, userInfo);

      return { success: true, userInfo };
    } catch (error) {
      console.error(`OAuth user info error for ${provider}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch user info' 
      };
    }
  }

  // Link OAuth account to user profile
  public async linkAccount(
    userId: string,
    provider: string,
    code: string,
    state: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<OAuthLinkResult> {
    try {
      // Validate state parameter
      if (!this.validateState(state, userId, provider)) {
        await this.auditService.logSecurityEvent(
          SecurityAction.OAUTH_LINK,
          {
            userId,
            resource: `linkedAccount:${userId}:${provider}`,
            eventData: {
              provider,
              error: 'Invalid state parameter',
              suspiciousActivity: true,
            },
            ...context,
          }
        );

        return {
          success: false,
          errors: ['Invalid authorization state'],
        };
      }

      // Exchange code for token
      const tokenResult = await this.exchangeCodeForToken(provider, code, state);
      if (!tokenResult.success) {
        return {
          success: false,
          errors: [tokenResult.error || 'Failed to exchange authorization code'],
        };
      }

      // Get user info from provider
      const userInfoResult = await this.getUserInfo(provider, tokenResult.tokenResponse!.access_token);
      if (!userInfoResult.success) {
        return {
          success: false,
          errors: [userInfoResult.error || 'Failed to fetch user information'],
        };
      }

      const userInfo = userInfoResult.userInfo!;

      // Check if this provider account is already linked to another user
      const existingAccount = await this.repository.getLinkedAccount(userId, provider);
      if (existingAccount && existingAccount.providerId !== userInfo.id) {
        // Different account for same provider
        await this.repository.unlinkAccount(userId, provider);
      }

      // Check if this provider account is linked to a different user
      const conflictingUser = await this.findUserByProviderAccount(provider, userInfo.id);
      if (conflictingUser && conflictingUser !== userId) {
        return {
          success: false,
          errors: ['This account is already linked to another user'],
        };
      }

      // Prepare linked account data
      const expiresAt = tokenResult.tokenResponse!.expires_in
        ? new Date(Date.now() + tokenResult.tokenResponse!.expires_in * 1000)
        : undefined;

      const accountData: LinkedAccountData = {
        provider,
        providerId: userInfo.id,
        providerEmail: userInfo.email,
        displayName: userInfo.name || userInfo.username,
        profileUrl: userInfo.profile_url,
        avatarUrl: userInfo.avatar_url,
        accessToken: this.encryptToken(tokenResult.tokenResponse!.access_token),
        refreshToken: tokenResult.tokenResponse!.refresh_token 
          ? this.encryptToken(tokenResult.tokenResponse!.refresh_token)
          : undefined,
        expiresAt,
        scope: tokenResult.tokenResponse!.scope,
        metadata: {
          originalUserInfo: userInfo,
          tokenType: tokenResult.tokenResponse!.token_type,
        },
      };

      // Link the account
      const linkedAccount = await this.repository.linkAccount(userId, accountData);

      if (!linkedAccount) {
        return {
          success: false,
          errors: ['Failed to link account'],
        };
      }

      // Log successful linking
      await this.auditService.logUserManagementEvent(
        SecurityAction.OAUTH_LINK,
        {
          userId,
          resource: `linkedAccount:${userId}:${provider}`,
          eventData: {
            provider,
            providerId: userInfo.id,
            providerEmail: userInfo.email,
            displayName: userInfo.name,
          },
          ...context,
        }
      );

      return {
        success: true,
        linkedAccount,
      };

    } catch (error) {
      console.error('OAuth linking error:', error);
      
      await this.auditService.logSecurityEvent(
        SecurityAction.OAUTH_LINK,
        {
          userId,
          resource: `linkedAccount:${userId}:${provider}`,
          eventData: {
            provider,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ...context,
        }
      );

      return {
        success: false,
        errors: ['Failed to link OAuth account'],
      };
    }
  }

  // Refresh access token using refresh token
  public async refreshAccessToken(
    userId: string,
    provider: string
  ): Promise<{
    success: boolean;
    newAccessToken?: string;
    error?: string;
  }> {
    try {
      const linkedAccount = await this.repository.getLinkedAccount(userId, provider);
      if (!linkedAccount) {
        return { success: false, error: 'No linked account found' };
      }

      const config = this.providers.get(provider);
      if (!config) {
        return { success: false, error: 'Unknown OAuth provider' };
      }

      // Get encrypted refresh token from database
      const refreshToken = await this.getEncryptedRefreshToken(userId, provider);
      if (!refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      const decryptedRefreshToken = this.decryptToken(refreshToken);

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: decryptedRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenResponse: OAuthTokenResponse = await response.json();

      // Update the stored access token
      await this.updateStoredTokens(
        userId,
        provider,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_in
      );

      return { 
        success: true, 
        newAccessToken: tokenResponse.access_token 
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token refresh failed' 
      };
    }
  }

  // Sync profile data from linked accounts
  public async syncProfileFromLinkedAccounts(
    userId: string,
    providers?: string[]
  ): Promise<{
    success: boolean;
    updatedFields?: string[];
    errors?: string[];
  }> {
    try {
      const linkedAccounts = await this.repository.getLinkedAccounts(userId);
      const accountsToSync = providers 
        ? linkedAccounts.filter(acc => providers.includes(acc.provider))
        : linkedAccounts;

      const updatedFields: string[] = [];
      const errors: string[] = [];

      for (const account of accountsToSync) {
        try {
          const syncResult = await this.syncFromSingleAccount(userId, account);
          if (syncResult.success && syncResult.updatedFields) {
            updatedFields.push(...syncResult.updatedFields);
          } else if (syncResult.errors) {
            errors.push(...syncResult.errors);
          }
        } catch (error) {
          errors.push(`Failed to sync from ${account.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        updatedFields: [...new Set(updatedFields)], // Remove duplicates
        errors,
      };

    } catch (error) {
      console.error('Profile sync error:', error);
      return {
        success: false,
        errors: ['Failed to sync profile from linked accounts'],
      };
    }
  }

  // Private helper methods
  private generateState(userId: string, provider: string): string {
    const data = {
      userId,
      provider,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2),
    };

    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  private validateState(state: string, userId: string, provider: string): boolean {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      
      // Check if state matches expected user and provider
      if (decoded.userId !== userId || decoded.provider !== provider) {
        return false;
      }

      // Check if state is not too old (5 minutes)
      const ageMs = Date.now() - decoded.timestamp;
      return ageMs < (5 * 60 * 1000);

    } catch {
      return false;
    }
  }

  private normalizeUserInfo(provider: string, rawUserInfo: any): OAuthUserInfo {
    switch (provider) {
      case 'google':
        return {
          id: rawUserInfo.id,
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          avatar_url: rawUserInfo.picture,
          profile_url: `https://plus.google.com/${rawUserInfo.id}`,
          ...rawUserInfo,
        };

      case 'github':
        return {
          id: rawUserInfo.id.toString(),
          email: rawUserInfo.email,
          name: rawUserInfo.name,
          username: rawUserInfo.login,
          avatar_url: rawUserInfo.avatar_url,
          profile_url: rawUserInfo.html_url,
          ...rawUserInfo,
        };

      case 'linkedin':
        return {
          id: rawUserInfo.id,
          name: `${rawUserInfo.localizedFirstName || ''} ${rawUserInfo.localizedLastName || ''}`.trim(),
          avatar_url: rawUserInfo.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier,
          profile_url: rawUserInfo.vanityName ? `https://linkedin.com/in/${rawUserInfo.vanityName}` : undefined,
          ...rawUserInfo,
        };

      case 'twitter':
        return {
          id: rawUserInfo.id,
          name: rawUserInfo.name,
          username: rawUserInfo.username,
          avatar_url: rawUserInfo.profile_image_url,
          profile_url: `https://twitter.com/${rawUserInfo.username}`,
          ...rawUserInfo,
        };

      default:
        return rawUserInfo;
    }
  }

  private encryptToken(token: string): string {
    // In production, use proper encryption
    // For now, just return the token (implement proper encryption later)
    return Buffer.from(token).toString('base64');
  }

  private decryptToken(encryptedToken: string): string {
    // In production, use proper decryption
    // For now, just decode the token
    return Buffer.from(encryptedToken, 'base64').toString();
  }

  private async findUserByProviderAccount(provider: string, providerId: string): Promise<string | null> {
    const existingAccount = await prisma.linkedAccount.findFirst({
      where: {
        provider,
        providerId,
        isActive: true,
      },
      select: {
        userId: true,
      },
    });

    return existingAccount?.userId || null;
  }

  private async getEncryptedRefreshToken(userId: string, provider: string): Promise<string | null> {
    const account = await prisma.linkedAccount.findFirst({
      where: {
        userId,
        provider,
        isActive: true,
      },
      select: {
        refreshToken: true,
      },
    });

    return account?.refreshToken || null;
  }

  private async updateStoredTokens(
    userId: string,
    provider: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<void> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
    const updateData: any = {
      accessToken: this.encryptToken(accessToken),
      lastSyncAt: new Date(),
    };

    if (refreshToken) {
      updateData.refreshToken = this.encryptToken(refreshToken);
    }

    if (expiresAt) {
      updateData.expiresAt = expiresAt;
    }

    await prisma.linkedAccount.updateMany({
      where: {
        userId,
        provider,
        isActive: true,
      },
      data: updateData,
    });
  }

  private async syncFromSingleAccount(userId: string, account: LinkedAccount): Promise<{
    success: boolean;
    updatedFields?: string[];
    errors?: string[];
  }> {
    // This method would sync specific data from each provider
    // Implementation would depend on what data you want to sync
    // For now, return a basic response
    return {
      success: true,
      updatedFields: [],
    };
  }

  // Public configuration methods
  public getAvailableProviders(): Array<{ key: string; name: string; configured: boolean }> {
    return Array.from(this.providers.entries()).map(([key, config]) => ({
      key,
      name: config.name,
      configured: !!config.clientId,
    }));
  }

  public isProviderConfigured(provider: string): boolean {
    const config = this.providers.get(provider);
    return !!(config && config.clientId);
  }
}