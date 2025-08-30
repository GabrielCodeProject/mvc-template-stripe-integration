import crypto from "crypto";

type DateTime = Date;

interface SessionConstructorParams {
  id: string;
  userId: string;
  token: string;
  expiresAt: DateTime;
  createdAt?: DateTime;
  updatedAt?: DateTime;
  ipAddress?: string;
  userAgent?: string;
  isActive?: boolean;
}

interface SessionJSON {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export class Session {
  private _id: string;
  private _userId: string;
  private _token: string;
  private _expiresAt: DateTime;
  private _createdAt: DateTime;
  private _updatedAt: DateTime;
  private _ipAddress?: string;
  private _userAgent?: string;
  private _isActive: boolean;

  constructor(params: SessionConstructorParams) {
    this._id = params.id;
    this._userId = params.userId;
    this._token = params.token;
    this._expiresAt = params.expiresAt;
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
    this._ipAddress = params.ipAddress;
    this._userAgent = params.userAgent;
    this._isActive = params.isActive ?? true;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get token(): string {
    return this._token;
  }

  get expiresAt(): DateTime {
    return this._expiresAt;
  }

  get createdAt(): DateTime {
    return this._createdAt;
  }

  get updatedAt(): DateTime {
    return this._updatedAt;
  }

  get ipAddress(): string | undefined {
    return this._ipAddress;
  }

  get userAgent(): string | undefined {
    return this._userAgent;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // Session validation
  public isValid(): boolean {
    return this._isActive && this._expiresAt > new Date();
  }

  public isExpired(): boolean {
    return this._expiresAt <= new Date();
  }

  // Session management
  public extend(hours: number = 24): void {
    this._expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    this._updatedAt = new Date();
  }

  public revoke(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  public activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  // Update session metadata
  public updateMetadata(ipAddress?: string, userAgent?: string): void {
    if (ipAddress) this._ipAddress = ipAddress;
    if (userAgent) this._userAgent = userAgent;
    this._updatedAt = new Date();
  }

  // Generate session token
  public static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create session with generated token
  public static create(
    userId: string,
    expirationHours: number = 24,
    ipAddress?: string,
    userAgent?: string
  ): Session {
    const token = Session.generateToken();
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
    
    return new Session({
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
      isActive: true
    });
  }

  // Session validation
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._userId || this._userId.trim().length === 0) {
      errors.push("User ID is required");
    }

    if (!this._token || this._token.trim().length === 0) {
      errors.push("Token is required");
    }

    if (!this._expiresAt) {
      errors.push("Expiration date is required");
    } else if (this._expiresAt <= this._createdAt) {
      errors.push("Expiration date must be after creation date");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Get remaining session time in milliseconds
  public getTimeRemaining(): number {
    if (!this.isValid()) return 0;
    return Math.max(0, this._expiresAt.getTime() - Date.now());
  }

  // Get remaining session time in human-readable format
  public getTimeRemainingFormatted(): string {
    const timeRemaining = this.getTimeRemaining();
    if (timeRemaining === 0) return "Expired";

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Serialization
  public toJSON(): SessionJSON {
    return {
      id: this._id,
      userId: this._userId,
      token: this._token,
      expiresAt: this._expiresAt.toISOString(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      isActive: this._isActive
    };
  }

  // Safe serialization (without token for client-side) with device info
  public toSafeJSON(): Omit<SessionJSON, 'token'> & {
    deviceInfo: {
      browser?: string;
      os?: string;
      device?: string;
      isMobile: boolean;
      isTablet: boolean;
      isDesktop: boolean;
    };
    deviceDisplayName: string;
    locationInfo: {
      ip?: string;
      displayLocation: string;
    };
    lastActiveFormatted: string;
    deviceIcon: string;
  } {
    const json = this.toJSON();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token, ...safeJson } = json;
    
    return {
      ...safeJson,
      deviceInfo: this.getDeviceInfo(),
      deviceDisplayName: this.getDeviceDisplayName(),
      locationInfo: this.getLocationInfo(),
      lastActiveFormatted: this.getLastActiveFormatted(),
      deviceIcon: this.getDeviceIcon(),
    };
  }

  // Deserialization
  public static fromJSON(json: SessionJSON): Session {
    return new Session({
      id: json.id,
      userId: json.userId,
      token: json.token,
      expiresAt: new Date(json.expiresAt),
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt),
      ipAddress: json.ipAddress,
      userAgent: json.userAgent,
      isActive: json.isActive
    });
  }

  // Create from Prisma model
  public static fromPrismaModel(data: any): Session {
    return new Session({
      id: data.id,
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      isActive: data.isActive
    });
  }

  // Check if session needs refresh (less than 25% time remaining)
  public needsRefresh(): boolean {
    if (!this.isValid()) return false;
    
    const totalDuration = this._expiresAt.getTime() - this._createdAt.getTime();
    const timeRemaining = this.getTimeRemaining();
    
    return timeRemaining < (totalDuration * 0.25);
  }

  // Get session age in milliseconds
  public getAge(): number {
    return Date.now() - this._createdAt.getTime();
  }

  // Parse user agent string for device information
  public getDeviceInfo(): {
    browser?: string;
    os?: string;
    device?: string;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
  } {
    if (!this._userAgent) {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
      };
    }

    return Session.parseUserAgent(this._userAgent);
  }

  // Static method to parse user agent
  public static parseUserAgent(userAgent: string): {
    browser?: string;
    os?: string;
    device?: string;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
  } {
    const ua = userAgent.toLowerCase();
    
    // Browser detection
    let browser: string | undefined;
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
    } else if (ua.includes('edg')) {
      browser = 'Edge';
    } else if (ua.includes('opera') || ua.includes('opr')) {
      browser = 'Opera';
    }

    // OS detection
    let os: string | undefined;
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('mac')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
    }

    // Device type detection
    const isMobile = /mobile|android|iphone/i.test(ua);
    const isTablet = /tablet|ipad/i.test(ua);
    const isDesktop = !isMobile && !isTablet;

    // Device name detection
    let device: string | undefined;
    if (ua.includes('iphone')) {
      device = 'iPhone';
    } else if (ua.includes('ipad')) {
      device = 'iPad';
    } else if (ua.includes('android')) {
      if (isTablet) {
        device = 'Android Tablet';
      } else {
        device = 'Android Phone';
      }
    }

    return {
      browser,
      os,
      device,
      isMobile,
      isTablet,
      isDesktop,
    };
  }

  // Get formatted device string for display
  public getDeviceDisplayName(): string {
    const deviceInfo = this.getDeviceInfo();
    
    if (deviceInfo.device) {
      return deviceInfo.browser 
        ? `${deviceInfo.device} • ${deviceInfo.browser}`
        : deviceInfo.device;
    }
    
    if (deviceInfo.browser && deviceInfo.os) {
      return `${deviceInfo.browser} on ${deviceInfo.os}`;
    }
    
    if (deviceInfo.browser) {
      return deviceInfo.browser;
    }
    
    if (deviceInfo.os) {
      return deviceInfo.os;
    }
    
    return 'Unknown Device';
  }

  // Get location info from IP (basic implementation)
  public getLocationInfo(): {
    ip?: string;
    displayLocation: string;
  } {
    if (!this._ipAddress) {
      return {
        displayLocation: 'Unknown Location',
      };
    }

    // For now, just show the IP address
    // In a real application, you would use a geolocation service
    return {
      ip: this._ipAddress,
      displayLocation: `IP: ${this._ipAddress}`,
    };
  }

  // Get last active time in human-readable format
  public getLastActiveFormatted(): string {
    const now = new Date();
    const diffMs = now.getTime() - this._updatedAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return this._updatedAt.toLocaleDateString();
    }
  }

  // Get session type icon based on device
  public getDeviceIcon(): string {
    const deviceInfo = this.getDeviceInfo();
    
    if (deviceInfo.isMobile) {
      return '📱';
    } else if (deviceInfo.isTablet) {
      return '📱'; // tablet icon
    } else {
      return '💻'; // desktop icon
    }
  }
}

// Type exports
export type { SessionConstructorParams, SessionJSON };