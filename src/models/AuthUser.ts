import { User } from "./User";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import crypto from "crypto";

// Import the type from User model
type UserConstructorParams = {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  image?: string;
  phone?: number;
  twoFactorEnabled?: boolean;
  isActive?: boolean;
  role?: string;
  stripeCustomerId?: string;
  preferredCurrency?: string;
  timezone?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
  accounts?: any[];
  sessions?: any[];
};

interface AuthUserConstructorParams extends UserConstructorParams {
  passwordHash?: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpiresAt?: Date;
  twoFactorSecret?: string;
  backupCodes?: string[];
}

export class AuthUser extends User {
  private _passwordHash?: string;
  private _verificationToken?: string;
  private _resetToken?: string;
  private _resetTokenExpiresAt?: Date;
  private _twoFactorSecret?: string;
  private _backupCodes?: string[];

  constructor(params: AuthUserConstructorParams) {
    super(params);
    this._passwordHash = params.passwordHash;
    this._verificationToken = params.verificationToken;
    this._resetToken = params.resetToken;
    this._resetTokenExpiresAt = params.resetTokenExpiresAt;
    this._twoFactorSecret = params.twoFactorSecret;
    this._backupCodes = params.backupCodes || [];
  }

  // Password management
  public async setPassword(password: string): Promise<void> {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    this._passwordHash = await bcrypt.hash(password, 12);
    this._updatedAt = new Date();
  }

  public async verifyPassword(password: string): Promise<boolean> {
    if (!this._passwordHash) return false;
    return bcrypt.compare(password, this._passwordHash);
  }

  public get passwordHash(): string | undefined {
    return this._passwordHash;
  }

  // Verification token management
  public generateVerificationToken(): string {
    this._verificationToken = crypto.randomUUID();
    return this._verificationToken;
  }

  public get verificationToken(): string | undefined {
    return this._verificationToken;
  }

  public clearVerificationToken(): void {
    this._verificationToken = undefined;
  }

  // Reset token management
  public generateResetToken(): string {
    this._resetToken = crypto.randomUUID();
    this._resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return this._resetToken;
  }

  public get resetToken(): string | undefined {
    return this._resetToken;
  }

  public get resetTokenExpiresAt(): Date | undefined {
    return this._resetTokenExpiresAt;
  }

  public isResetTokenValid(): boolean {
    if (!this._resetToken || !this._resetTokenExpiresAt) {
      return false;
    }
    return this._resetTokenExpiresAt > new Date();
  }

  public clearResetToken(): void {
    this._resetToken = undefined;
    this._resetTokenExpiresAt = undefined;
  }

  // Two-factor authentication
  public generateTwoFactorSecret(): { secret: string; qrCodeUrl: string; backupCodes: string[] } {
    const secret = speakeasy.generateSecret({
      name: `${this._name} (${this._email})`,
      issuer: process.env.APP_NAME || "MyApp",
      length: 32 // More secure length
    });

    // Store encrypted secret
    this._twoFactorSecret = this.encryptSensitiveData(secret.base32);
    
    // Generate 10 backup codes, 8 characters each (alphanumeric)
    const backupCodes = Array.from({ length: 10 }, () => {
      const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // No O, 0 for clarity
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(crypto.randomBytes(1)[0] / 256 * chars.length));
      }
      return code;
    });
    
    // Store hashed backup codes for security
    this._backupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code + this._email).digest('hex')
    );

    // Create QR code URL
    const qrCodeUrl = `otpauth://totp/${encodeURIComponent(this._email)}?secret=${secret.base32}&issuer=${encodeURIComponent(process.env.APP_NAME || 'MyApp')}`;

    return {
      secret: secret.base32, // Return unencrypted for QR code generation
      qrCodeUrl,
      backupCodes // Return plain codes for user to save
    };
  }

  public enableTwoFactor(): void {
    if (!this._twoFactorSecret) {
      throw new Error("Two-factor secret not generated");
    }
    this._twoFactorEnabled = true;
    this._updatedAt = new Date();
  }

  public disableTwoFactor(): void {
    this._twoFactorEnabled = false;
    this._twoFactorSecret = undefined;
    this._backupCodes = [];
    this._updatedAt = new Date();
  }

  public validateTOTP(token: string): boolean {
    if (!this._twoFactorSecret) {
      return false;
    }

    try {
      // Decrypt the stored secret
      const decryptedSecret = this.decryptSensitiveData(this._twoFactorSecret);
      
      return speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: token.replace(/\s/g, ''), // Remove any spaces
        window: 1 // ±30 seconds window for time drift
      });
    } catch (error) {
      console.error('TOTP validation error:', error);
      return false;
    }
  }

  public validateBackupCode(code: string): boolean {
    if (!this._backupCodes || this._backupCodes.length === 0) return false;
    
    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    const hashedCode = crypto.createHash('sha256').update(normalizedCode + this._email).digest('hex');
    
    const index = this._backupCodes.findIndex(bc => bc === hashedCode);
    
    if (index === -1) {
      return false;
    }

    // Remove used backup code
    this._backupCodes.splice(index, 1);
    this._updatedAt = new Date();
    return true;
  }

  public get backupCodes(): string[] {
    // Return empty array - backup codes should never be retrievable after generation
    return [];
  }

  public get backupCodesRemaining(): number {
    return this._backupCodes ? this._backupCodes.length : 0;
  }

  public generateNewBackupCodes(): string[] {
    // Generate 10 new backup codes
    const backupCodes = Array.from({ length: 10 }, () => {
      const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(crypto.randomBytes(1)[0] / 256 * chars.length));
      }
      return code;
    });
    
    // Store hashed versions
    this._backupCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code + this._email).digest('hex')
    );
    
    this._updatedAt = new Date();
    return backupCodes; // Return plain codes for user to save
  }

  public get twoFactorSecret(): string | undefined {
    return this._twoFactorSecret;
  }

  // Encryption methods for sensitive data
  private encryptSensitiveData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }
  
  private decryptSensitiveData(encryptedData: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher(algorithm, key);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  // Enhanced validation including auth fields
  public validate(): { isValid: boolean; errors: string[] } {
    const baseValidation = super.validate();
    const errors = [...baseValidation.errors];

    // Additional auth validation
    if (this._resetToken && !this._resetTokenExpiresAt) {
      errors.push("Reset token must have expiration date");
    }

    if (this._resetTokenExpiresAt && this._resetTokenExpiresAt <= new Date()) {
      errors.push("Reset token has expired");
    }

    if (this._twoFactorEnabled && !this._twoFactorSecret) {
      errors.push("Two-factor enabled but secret not set");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Enhanced toJSON with auth fields (excluding sensitive data)
  public toJSON(): Record<string, unknown> {
    const baseJson = super.toJSON();
    
    return {
      ...baseJson,
      hasPassword: !!this._passwordHash,
      isVerified: this.emailVerified,
      twoFactorEnabled: this.twoFactorEnabled,
      backupCodesRemaining: this._backupCodes ? this._backupCodes.length : 0
    };
  }

  // Create AuthUser from JSON
  public static fromJSON(json: any): AuthUser {
    const authUser = new AuthUser({
      id: json.id,
      email: json.email,
      name: json.name,
      emailVerified: json.emailVerified,
      image: json.image,
      phone: json.phone,
      twoFactorEnabled: json.twoFactorEnabled,
      isActive: json.isActive,
      role: json.role,
      stripeCustomerId: json.stripeCustomerId,
      preferredCurrency: json.preferredCurrency,
      timezone: json.timezone,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
      lastLoginAt: json.lastLoginAt ? new Date(json.lastLoginAt) : undefined,
      passwordHash: json.passwordHash,
      verificationToken: json.verificationToken,
      resetToken: json.resetToken,
      resetTokenExpiresAt: json.resetTokenExpiresAt ? new Date(json.resetTokenExpiresAt) : undefined,
      twoFactorSecret: json.twoFactorSecret,
      backupCodes: json.backupCodes || []
    });

    return authUser;
  }

  // Create AuthUser from Prisma model
  public static fromPrismaModel(data: any): AuthUser {
    const credentialsAccount = data.accounts?.find((acc: any) => acc.providerId === 'credentials');
    
    return new AuthUser({
      id: data.id,
      email: data.email,
      name: data.name,
      emailVerified: data.emailVerified,
      image: data.image,
      phone: data.phone,
      twoFactorEnabled: data.twoFactorEnabled,
      isActive: data.isActive,
      role: data.role,
      stripeCustomerId: data.stripeCustomerId,
      preferredCurrency: data.preferredCurrency,
      timezone: data.timezone,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastLoginAt: data.lastLoginAt,
      passwordHash: credentialsAccount?.password,
      verificationToken: credentialsAccount?.verificationToken,
      resetToken: credentialsAccount?.resetToken,
      resetTokenExpiresAt: credentialsAccount?.resetTokenExpiresAt,
      // Use User table fields for 2FA data
      twoFactorSecret: data.twoFactorSecret,
      backupCodes: data.backupCodes || []
    });
  }
}

// Type exports for use in other files
export type { AuthUserConstructorParams };