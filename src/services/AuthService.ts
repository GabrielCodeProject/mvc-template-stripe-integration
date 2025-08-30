import { AuthUser } from '@/models/AuthUser';
import { Session } from '@/models/Session';
import { AuthRepository } from '@/repositories/AuthRepository';
import { SessionService } from './SessionService';
import { SecurityAuditLogService } from './SecurityAuditLogService';
import { SecurityAction, SecuritySeverity } from '@/models/SecurityAuditLog';
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
  private auditService: SecurityAuditLogService;
  private static instance: AuthService;

  private constructor() {
    this.authRepository = AuthRepository.getInstance();
    this.sessionService = SessionService.getInstance();
    this.auditService = SecurityAuditLogService.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // User registration
  public async register(data: RegisterInput, ipAddress?: string, userAgent?: string): Promise<AuthUser> {
    try {
      // Validate input
      if (!data.email || !data.password || !data.name) {
        await this.auditService.logAuthEvent(
          SecurityAction.USER_CREATED,
          {
            email: data.email,
            ipAddress,
            userAgent,
            eventData: { 
              error: 'Missing required fields',
              providedFields: {
                email: !!data.email,
                password: !!data.password,
                name: !!data.name
              }
            }
          },
          false
        );
        throw new Error('Email, password, and name are required');
      }

      if (data.password.length < 8) {
        await this.auditService.logAuthEvent(
          SecurityAction.USER_CREATED,
          {
            email: data.email,
            ipAddress,
            userAgent,
            eventData: { 
              error: 'Password too short',
              passwordLength: data.password.length
            }
          },
          false
        );
        throw new Error('Password must be at least 8 characters long');
      }

      // Check if user already exists
      const existingUser = await this.authRepository.findByEmail(data.email);
      if (existingUser) {
        await this.auditService.logAuthEvent(
          SecurityAction.USER_CREATED,
          {
            email: data.email,
            ipAddress,
            userAgent,
            eventData: { error: 'User already exists' }
          },
          false
        );
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

      // Log successful registration
      await this.auditService.logUserManagementEvent(
        SecurityAction.USER_CREATED,
        {
          userId: savedUser.id,
          email: savedUser.email,
          ipAddress,
          userAgent,
          eventData: {
            name: savedUser.name,
            requiresEmailVerification: !savedUser.emailVerified
          }
        }
      );

      // TODO: Send verification email
      // await this.emailService.sendVerificationEmail(savedUser.email, verificationToken);

      return savedUser;
    } catch (error) {
      // Log failed registration if not already logged
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('required') && !errorMessage.includes('too short') && !errorMessage.includes('already exists')) {
        await this.auditService.logAuthEvent(
          SecurityAction.USER_CREATED,
          {
            email: data.email,
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // User login
  public async login(
    email: string,
    password: string,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Validate input
      if (!email || !password) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN_FAILED,
          {
            email: normalizedEmail,
            ipAddress,
            userAgent,
            eventData: { error: 'Missing email or password' }
          },
          false
        );
        throw new Error('Email and password are required');
      }

      // Find user
      const user = await this.authRepository.findByEmail(normalizedEmail);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN_FAILED,
          {
            email: normalizedEmail,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found' }
          },
          false
        );
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Account disabled' }
          },
          false
        );
        throw new Error('Account is disabled');
      }

      // Verify password
      const validPassword = await user.verifyPassword(password);
      if (!validPassword) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid password' }
          },
          false
        );
        throw new Error('Invalid credentials');
      }

      // Check if email is verified
      if (!user.emailVerified) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Email not verified' }
          },
          false
        );
        throw new Error('Please verify your email address first');
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        // Generate temporary 2FA token
        const twoFactorToken = this.generateTwoFactorToken(user.id);
        
        // Log partial login success (pending 2FA)
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { 
              requires2FA: true,
              rememberMe,
              partialLogin: true
            }
          }
        );
        
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

      // Log successful login
      await this.auditService.logSuccessfulLogin(user.id, user.email, {
        ipAddress,
        userAgent,
        sessionId: session.id,
        eventData: {
          rememberMe,
          sessionDuration: `${sessionHours} hours`
        }
      });

      return { user, session };
    } catch (error) {
      // Log any unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('required') && !errorMessage.includes('credentials') && 
          !errorMessage.includes('disabled') && !errorMessage.includes('verify')) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGIN_FAILED,
          {
            email: normalizedEmail,
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // Complete 2FA login
  public async complete2FALogin(
    twoFactorToken: string,
    code: string,
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    try {
      // Validate 2FA token (in real app, store these temporarily in Redis/cache)
      const userId = this.validateTwoFactorToken(twoFactorToken);
      if (!userId) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid 2FA token' }
          },
          false
        );
        throw new Error('Invalid or expired 2FA token');
      }

      // Get user
      const user = await this.authRepository.findById(userId);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found during 2FA' }
          },
          false
        );
        throw new Error('User not found');
      }

      // Validate TOTP or backup code
      const validTOTP = user.validateTOTP(code);
      const validBackup = !validTOTP && user.validateBackupCode(code);

      if (!validTOTP && !validBackup) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid 2FA code' }
          },
          false
        );
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

      // Log successful 2FA completion
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_VERIFIED,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          sessionId: session.id,
          eventData: {
            method: validBackup ? 'backup_code' : 'totp',
            rememberMe,
            sessionDuration: `${sessionHours} hours`
          }
        }
      );

      return { user, session };
    } catch (error) {
      // Log any unexpected 2FA errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('Invalid') && !errorMessage.includes('expired')) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // User logout
  public async logout(sessionToken: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // Get session details before revoking for logging
      const sessionDetails = await this.sessionService.validateSession(sessionToken);
      
      await this.sessionService.revokeSession(sessionToken);

      // Log logout
      if (sessionDetails) {
        await this.auditService.logAuthEvent(
          SecurityAction.LOGOUT,
          {
            userId: sessionDetails.userId,
            sessionId: sessionDetails.id,
            ipAddress,
            userAgent,
            eventData: {
              sessionRevoked: true
            }
          }
        );
      }
    } catch (error) {
      // Still try to log logout attempt even if session details couldn't be retrieved
      const errorMessage = error instanceof Error ? error.message : 'Logout error';
      await this.auditService.logAuthEvent(
        SecurityAction.LOGOUT,
        {
          ipAddress,
          userAgent,
          eventData: {
            error: errorMessage,
            sessionToken: sessionToken.substring(0, 8) + '...' // Log partial token for debugging
          }
        },
        false
      );
      throw error;
    }
  }

  // Logout from all devices
  public async logoutAllDevices(userId: string, currentToken?: string, ipAddress?: string, userAgent?: string): Promise<number> {
    try {
      const revokedCount = await this.sessionService.revokeAllUserSessions(userId, currentToken);

      // Log mass logout
      await this.auditService.logAuthEvent(
        SecurityAction.SESSION_TERMINATED,
        {
          userId,
          ipAddress,
          userAgent,
          eventData: {
            action: 'logout_all_devices',
            revokedSessions: revokedCount,
            currentSessionPreserved: !!currentToken
          }
        }
      );

      return revokedCount;
    } catch (error) {
      await this.auditService.logAuthEvent(
        SecurityAction.SESSION_TERMINATED,
        {
          userId,
          ipAddress,
          userAgent,
          eventData: {
            action: 'logout_all_devices_failed',
            error: (error instanceof Error ? error.message : 'Mass logout error')
          }
        },
        false
      );
      throw error;
    }
  }

  // Email verification
  public async verifyEmail(token: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
    try {
      const user = await this.authRepository.findByVerificationToken(token);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.EMAIL_VERIFICATION_FAILED,
          {
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid verification token', token: token.substring(0, 8) + '...' }
          },
          false
        );
        throw new Error('Invalid or expired verification token');
      }

      // Clear verification token and mark email as verified
      await this.authRepository.clearVerificationToken(user.id);

      // Log successful email verification
      await this.auditService.logAuthEvent(
        SecurityAction.EMAIL_VERIFIED,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          eventData: {
            verificationCompleted: true
          }
        }
      );

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('Invalid')) {
        await this.auditService.logAuthEvent(
          SecurityAction.EMAIL_VERIFICATION_FAILED,
          {
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true
            }
          },
          false
        );
      }
      throw error;
    }
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
  public async setup2FA(userId: string, ipAddress?: string, userAgent?: string): Promise<TwoFactorSetup> {
    try {
      const user = await this.authRepository.findById(userId);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found during 2FA setup' }
          },
          false
        );
        throw new Error('User not found');
      }

      if (user.twoFactorEnabled) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: '2FA already enabled during setup' }
          },
          false
        );
        throw new Error('Two-factor authentication is already enabled');
      }

      // Generate 2FA secret and backup codes with QR code
      const { secret, qrCodeUrl, backupCodes } = user.generateTwoFactorSecret();

      // Save encrypted secret to database (but don't enable yet)
      await this.authRepository.updateTwoFactor(
        user.id,
        user.twoFactorSecret, // This is already encrypted by the model
        user.backupCodes, // These are already hashed by the model
        false // Not enabled until verified
      );

      // Log 2FA setup initiation
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_SETUP,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          eventData: {
            action: 'setup_initiated',
            backupCodesGenerated: backupCodes.length
          }
        }
      );

      return {
        secret,
        qrCode: qrCodeUrl,
        backupCodes
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('not found') && !errorMessage.includes('already enabled')) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true,
              action: 'setup_failed'
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // Enable 2FA (after verification)
  public async enable2FA(userId: string, code: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const user = await this.authRepository.findById(userId);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found during 2FA enable' }
          },
          false
        );
        throw new Error('User not found');
      }

      if (user.twoFactorEnabled) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: '2FA already enabled' }
          },
          false
        );
        throw new Error('Two-factor authentication is already enabled');
      }

      // Validate TOTP code
      if (!user.validateTOTP(code)) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid TOTP code during enable' }
          },
          false
        );
        throw new Error('Invalid 2FA code');
      }

      // Enable 2FA
      await this.authRepository.updateTwoFactor(user.id, undefined, undefined, true);

      // Log successful 2FA enablement
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_ENABLED,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          eventData: {
            securityEnhancement: true
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('not found') && !errorMessage.includes('already enabled') && !errorMessage.includes('Invalid')) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // Disable 2FA
  public async disable2FA(userId: string, password: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const user = await this.authRepository.findById(userId);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found during 2FA disable' }
          },
          false
        );
        throw new Error('User not found');
      }

      if (!user.twoFactorEnabled) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: '2FA not enabled during disable attempt' }
          },
          false
        );
        throw new Error('Two-factor authentication is not enabled');
      }

      // Verify password
      const validPassword = await user.verifyPassword(password);
      if (!validPassword) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid password during 2FA disable' }
          },
          false
        );
        throw new Error('Invalid password');
      }

      // Disable 2FA
      user.disableTwoFactor();
      await this.authRepository.updateTwoFactor(user.id, undefined, [], false);

      // Log successful 2FA disablement
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_DISABLED,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          eventData: {
            securityChange: true,
            action: '2fa_disabled'
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('not found') && !errorMessage.includes('not enabled') && !errorMessage.includes('Invalid password')) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true,
              action: 'disable_failed'
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // Generate new backup codes
  public async generateNewBackupCodes(userId: string, password: string, ipAddress?: string, userAgent?: string): Promise<string[]> {
    try {
      const user = await this.authRepository.findById(userId);
      if (!user) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found during backup code generation' }
          },
          false
        );
        throw new Error('User not found');
      }

      if (!user.twoFactorEnabled) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: '2FA not enabled during backup code generation' }
          },
          false
        );
        throw new Error('Two-factor authentication is not enabled');
      }

      // Verify password
      const validPassword = await user.verifyPassword(password);
      if (!validPassword) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: { error: 'Invalid password during backup code generation' }
          },
          false
        );
        throw new Error('Invalid password');
      }

      // Generate new backup codes
      const newBackupCodes = user.generateNewBackupCodes();

      // Save to database
      await this.authRepository.updateTwoFactor(
        user.id,
        undefined, // Don't change secret
        user.backupCodes, // Save hashed codes
        undefined // Don't change enabled status
      );

      // Log backup code generation
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_BACKUP_CODES_GENERATED,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          eventData: {
            action: 'backup_codes_regenerated',
            codesGenerated: newBackupCodes.length
          }
        }
      );

      return newBackupCodes; // Return plain codes for user to save
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('not found') && !errorMessage.includes('not enabled') && !errorMessage.includes('Invalid password')) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { 
              error: errorMessage,
              unexpected: true,
              action: 'backup_codes_generation_failed'
            }
          },
          false
        );
      }
      throw error;
    }
  }

  // Verify 2FA code during login or sensitive operations
  public async verify2FACode(userId: string, code: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
    try {
      const user = await this.authRepository.findById(userId);
      if (!user || !user.twoFactorEnabled) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_FAILED,
          {
            userId,
            ipAddress,
            userAgent,
            eventData: { error: 'User not found or 2FA not enabled during verification' }
          },
          false
        );
        return false;
      }

      // Try TOTP first
      const validTOTP = user.validateTOTP(code);
      if (validTOTP) {
        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_VERIFIED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: {
              method: 'totp',
              action: 'code_verified'
            }
          }
        );
        return true;
      }

      // Try backup code
      const validBackup = user.validateBackupCode(code);
      if (validBackup) {
        // Update database with consumed backup code
        await this.authRepository.updateTwoFactor(
          user.id,
          undefined,
          user.backupCodes,
          undefined
        );

        await this.auditService.logAuthEvent(
          SecurityAction.TWO_FACTOR_VERIFIED,
          {
            userId: user.id,
            email: user.email,
            ipAddress,
            userAgent,
            eventData: {
              method: 'backup_code',
              action: 'backup_code_used',
              remainingBackupCodes: user.backupCodesRemaining
            }
          }
        );
        return true;
      }

      // Invalid code
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_FAILED,
        {
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          eventData: { error: 'Invalid 2FA code provided' }
        },
        false
      );
      return false;
    } catch (error) {
      await this.auditService.logAuthEvent(
        SecurityAction.TWO_FACTOR_FAILED,
        {
          userId,
          ipAddress,
          userAgent,
          eventData: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            unexpected: true,
            action: 'verification_error'
          }
        },
        false
      );
      return false;
    }
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