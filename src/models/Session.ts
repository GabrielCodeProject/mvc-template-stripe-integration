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

  // Safe serialization (without token for client-side)
  public toSafeJSON(): Omit<SessionJSON, 'token'> {
    const json = this.toJSON();
    const { token, ...safeJson } = json;
    return safeJson;
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
}

// Type exports
export type { SessionConstructorParams, SessionJSON };