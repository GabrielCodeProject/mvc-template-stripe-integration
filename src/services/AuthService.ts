import { AuthUser } from '@/models/AuthUser';
import { Session } from '@/models/Session';
import { AuthRepository } from '@/repositories/AuthRepository';
import { SessionService } from './SessionService';
import crypto from 'crypto';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  acceptTerms?: boolean;
}

interface LoginResult {
  user: AuthUser;
  session: Session;
  requires2FA?: boolean;
  twoFactorToken?: string;
}

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class AuthService {
  private authRepository: AuthRepository;
  private sessionService: SessionService;
  private static instance: AuthService;

  private constructor() {
    this.authRepository = AuthRepository.getInstance();
    this.sessionService = SessionService.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // User registration
  public async register(data: RegisterInput): Promise<AuthUser> {
    // Validate input
    if (!data.email || !data.password || !data.name) {
      throw new Error('Email, password, and name are required');
    }

    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await this.authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create user
    const user = new AuthUser({
      id: this.generateId(),
      email: data.email.toLowerCase().trim(),
      name: data.name.trim(),
      emailVerified: false, // Will be verified via email
      isActive: true
    });

    // Set password
    await user.setPassword(data.password);

    // Generate verification token
    const verificationToken = user.generateVerificationToken();

    // Save to database
    const savedUser = await this.authRepository.createWithPassword(
      user.email,
      user.passwordHash!,
      user.name,
      verificationToken
    );

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(savedUser.email, verificationToken);

    return savedUser;
  }

  // User login
  public async login(
    email: string,
    password: string,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user
    const user = await this.authRepository.findByEmail(email.toLowerCase().trim());
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const validPassword = await user.verifyPassword(password);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error('Please verify your email address first');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary 2FA token
      const twoFactorToken = this.generateTwoFactorToken(user.id);
      
      return {
        user,
        session: null as any, // No session until 2FA is completed
        requires2FA: true,
        twoFactorToken
      };
    }

    // Create session
    const sessionHours = rememberMe ? 30 * 24 : 24; // 30 days vs 1 day
    const session = await this.sessionService.createSession(
      user.id,
      sessionHours,
      ipAddress,
      userAgent
    );

    // Update last login
    await this.authRepository.updateLastLogin(user.id);

    return { user, session };
  }

  // Complete 2FA login
  public async complete2FALogin(
    twoFactorToken: string,
    code: string,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Validate 2FA token (in real app, store these temporarily in Redis/cache)
    const userId = this.validateTwoFactorToken(twoFactorToken);
    if (!userId) {
      throw new Error('Invalid or expired 2FA token');
    }

    // Get user
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate TOTP or backup code
    const validTOTP = user.validateTOTP(code);
    const validBackup = !validTOTP && user.validateBackupCode(code);

    if (!validTOTP && !validBackup) {
      throw new Error('Invalid 2FA code');
    }

    // If backup code was used, update the user
    if (validBackup) {
      await this.authRepository.updateTwoFactor(
        user.id,
        undefined,
        user.backupCodes
      );
    }

    // Create session
    const sessionHours = rememberMe ? 30 * 24 : 24;
    const session = await this.sessionService.createSession(
      user.id,
      sessionHours,
      ipAddress,
      userAgent
    );

    // Update last login
    await this.authRepository.updateLastLogin(user.id);

    return { user, session };
  }

  // User logout
  public async logout(sessionToken: string): Promise<void> {
    await this.sessionService.revokeSession(sessionToken);
  }

  // Logout from all devices
  public async logoutAllDevices(userId: string, currentToken?: string): Promise<number> {
    return await this.sessionService.revokeAllUserSessions(userId, currentToken);
  }

  // Email verification
  public async verifyEmail(token: string): Promise<boolean> {
    const user = await this.authRepository.findByVerificationToken(token);
    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    // Clear verification token and mark email as verified
    await this.authRepository.clearVerificationToken(user.id);

    return true;
  }

  // Resend verification email
  public async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.authRepository.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = user.generateVerificationToken();
    await this.authRepository.saveVerificationToken(user.id, verificationToken);

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(user.email, verificationToken);
  }

  // Initiate password reset
  public async initiatePasswordReset(email: string): Promise<void> {
    const user = await this.authRepository.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Don't reveal if user exists for security
      return;
    }

    // Generate reset token
    const resetToken = user.generateResetToken();
    await this.authRepository.saveResetToken(
      user.id,
      resetToken,
      user.resetTokenExpiresAt!
    );

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  // Reset password
  public async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const user = await this.authRepository.findByResetToken(token);
    if (!user || !user.isResetTokenValid()) {
      throw new Error('Invalid or expired reset token');
    }

    // Update password
    await user.setPassword(newPassword);
    await this.authRepository.updatePassword(user.id, user.passwordHash!);

    // Clear reset token
    await this.authRepository.clearResetToken(user.id);

    // Revoke all existing sessions for security
    await this.sessionService.revokeAllUserSessions(user.id);
  }

  // Change password (authenticated user)
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const validPassword = await user.verifyPassword(currentPassword);
    if (!validPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    await user.setPassword(newPassword);
    await this.authRepository.updatePassword(user.id, user.passwordHash!);

    // Revoke all other sessions for security
    await this.sessionService.revokeAllUserSessions(user.id);
  }

  // Setup 2FA
  public async setup2FA(userId: string): Promise<TwoFactorSetup> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new Error('Two-factor authentication is already enabled');
    }

    // Generate 2FA secret and backup codes
    const { secret, backupCodes } = user.generateTwoFactorSecret();

    // Save to database (but don't enable yet)
    await this.authRepository.updateTwoFactor(
      user.id,
      secret,
      backupCodes,
      false // Not enabled until verified
    );

    // Generate QR code URL
    const qrCode = `otpauth://totp/${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(process.env.APP_NAME || 'MyApp')}`;

    return {
      secret,
      qrCode,
      backupCodes
    };
  }

  // Enable 2FA (after verification)
  public async enable2FA(userId: string, code: string): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new Error('Two-factor authentication is already enabled');
    }

    // Validate TOTP code
    if (!user.validateTOTP(code)) {
      throw new Error('Invalid 2FA code');
    }

    // Enable 2FA
    await this.authRepository.updateTwoFactor(user.id, undefined, undefined, true);
  }

  // Disable 2FA
  public async disable2FA(userId: string, password: string): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const validPassword = await user.verifyPassword(password);
    if (!validPassword) {
      throw new Error('Invalid password');
    }

    // Disable 2FA
    user.disableTwoFactor();
    await this.authRepository.updateTwoFactor(user.id, undefined, [], false);
  }

  // Update user profile
  public async updateProfile(
    userId: string,
    updates: {
      name?: string;
      phone?: string;
      timezone?: string;
      preferredCurrency?: string;
      image?: string;
    }
  ): Promise<AuthUser> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate updates
    if (updates.name && updates.name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }

    return await this.authRepository.updateProfile(userId, updates);
  }

  // Get user by session token
  public async getUserBySession(token: string): Promise<AuthUser | null> {
    const sessionWithUser = await this.sessionService.validateSession(token);
    if (!sessionWithUser) {
      return null;
    }

    return await this.authRepository.findById(sessionWithUser.userId);
  }

  // Helper methods
  private generateId(): string {
    return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateTwoFactorToken(userId: string): string {
    // In a real application, store this in Redis with expiration
    return crypto.createHash('sha256').update(`${userId}_${Date.now()}`).digest('hex');
  }

  private validateTwoFactorToken(token: string): string | null {
    // In a real application, validate against Redis store
    // For now, just return null (implement proper validation)
    return null;
  }

  // Admin methods
  public async deactivateUser(userId: string): Promise<void> {
    // Revoke all sessions
    await this.sessionService.revokeAllUserSessions(userId);
    
    // Mark user as inactive (implement in repository)
    // await this.authRepository.deactivateUser(userId);
  }

  // Maintenance methods
  public async performMaintenance(): Promise<{
    expiredTokensCleaned: number;
    sessionsMaintenanceResult: any;
  }> {
    const [expiredTokensCleaned, sessionsMaintenanceResult] = await Promise.all([
      this.authRepository.cleanupExpiredResetTokens(),
      this.sessionService.performMaintenance()
    ]);

    return {
      expiredTokensCleaned,
      sessionsMaintenanceResult
    };
  }
}