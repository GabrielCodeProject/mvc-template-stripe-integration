import { createHash } from 'crypto';

type DateTime = Date;

// Event types for categorizing security events
export enum SecurityEventType {
  AUTH = 'AUTH',
  USER_MGMT = 'USER_MGMT',
  SECURITY = 'SECURITY',
  DATA_ACCESS = 'DATA_ACCESS',
  SYSTEM = 'SYSTEM'
}

// Specific security actions
export enum SecurityAction {
  // Authentication actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',
  LOGIN_LOCKED = 'login_locked',
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  SESSION_TERMINATED = 'session_terminated',
  
  // Password actions
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_FAILED = 'password_reset_failed',
  
  // Two-factor authentication
  TWO_FACTOR_ENABLED = 'two_factor_enabled',
  TWO_FACTOR_DISABLED = 'two_factor_disabled',
  TWO_FACTOR_VERIFIED = 'two_factor_verified',
  TWO_FACTOR_FAILED = 'two_factor_failed',
  TWO_FACTOR_SETUP = 'two_factor_setup',
  TWO_FACTOR_BACKUP_CODES_GENERATED = 'two_factor_backup_codes_generated',
  
  // User management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_ACTIVATED = 'user_activated',
  USER_DEACTIVATED = 'user_deactivated',
  
  // Email verification
  EMAIL_VERIFICATION_SENT = 'email_verification_sent',
  EMAIL_VERIFIED = 'email_verified',
  EMAIL_VERIFICATION_FAILED = 'email_verification_failed',
  
  // Security events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  
  // Data access
  DATA_VIEWED = 'data_viewed',
  DATA_EXPORTED = 'data_exported',
  DATA_IMPORTED = 'data_imported',
  
  // System events
  SYSTEM_CONFIG_CHANGED = 'system_config_changed',
  BACKUP_CREATED = 'backup_created',
  MAINTENANCE_MODE = 'maintenance_mode'
}

// Severity levels for events
export enum SecuritySeverity {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface SecurityAuditLogConstructorParams {
  id?: string;
  userId?: string;
  email?: string;
  eventType: SecurityEventType;
  action: SecurityAction;
  eventData?: Record<string, unknown>;
  success?: boolean;
  severity?: SecuritySeverity;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  resource?: string;
  createdAt?: DateTime;
}

export interface SecurityAuditLogJSON {
  id: string;
  userId?: string;
  email?: string;
  eventType: string;
  action: string;
  eventData?: Record<string, unknown>;
  success: boolean;
  severity: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  resource?: string;
  checksum?: string;
  createdAt: string;
}

export interface AuditLogFilter {
  userId?: string;
  email?: string;
  eventType?: SecurityEventType;
  action?: SecurityAction;
  success?: boolean;
  severity?: SecuritySeverity;
  ipAddress?: string;
  sessionId?: string;
  requestId?: string;
  resource?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export class SecurityAuditLog {
  private _id: string;
  private _userId?: string;
  private _email?: string;
  private _eventType: SecurityEventType;
  private _action: SecurityAction;
  private _eventData?: Record<string, unknown>;
  private _success: boolean;
  private _severity: SecuritySeverity;
  private _ipAddress?: string;
  private _userAgent?: string;
  private _sessionId?: string;
  private _requestId?: string;
  private _resource?: string;
  private _checksum?: string;
  private _createdAt: DateTime;

  constructor(params: SecurityAuditLogConstructorParams) {
    this._id = params.id ?? this.generateId();
    this._userId = params.userId;
    this._email = params.email;
    this._eventType = params.eventType;
    this._action = params.action;
    this._eventData = params.eventData;
    this._success = params.success ?? true;
    this._severity = params.severity ?? SecuritySeverity.INFO;
    this._ipAddress = params.ipAddress;
    this._userAgent = params.userAgent;
    this._sessionId = params.sessionId;
    this._requestId = params.requestId;
    this._resource = params.resource;
    this._createdAt = params.createdAt ?? new Date();
    
    // Generate checksum for tamper detection
    this._checksum = this.generateChecksum();
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get userId(): string | undefined {
    return this._userId;
  }

  get email(): string | undefined {
    return this._email;
  }

  get eventType(): SecurityEventType {
    return this._eventType;
  }

  get action(): SecurityAction {
    return this._action;
  }

  get eventData(): Record<string, unknown> | undefined {
    return this._eventData;
  }

  get success(): boolean {
    return this._success;
  }

  get severity(): SecuritySeverity {
    return this._severity;
  }

  get ipAddress(): string | undefined {
    return this._ipAddress;
  }

  get userAgent(): string | undefined {
    return this._userAgent;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get requestId(): string | undefined {
    return this._requestId;
  }

  get resource(): string | undefined {
    return this._resource;
  }

  get checksum(): string | undefined {
    return this._checksum;
  }

  get createdAt(): DateTime {
    return this._createdAt;
  }

  // Validation methods
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._eventType) {
      errors.push("Event type is required");
    }

    if (!this._action) {
      errors.push("Action is required");
    }

    if (!Object.values(SecurityEventType).includes(this._eventType)) {
      errors.push("Invalid event type");
    }

    if (!Object.values(SecurityAction).includes(this._action)) {
      errors.push("Invalid action");
    }

    if (!Object.values(SecuritySeverity).includes(this._severity)) {
      errors.push("Invalid severity level");
    }

    // Validate event type and action compatibility
    if (!this.isEventTypeActionCompatible()) {
      errors.push("Event type and action are not compatible");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Check if the current checksum matches the expected checksum (tamper detection)
  public verifyIntegrity(): boolean {
    const expectedChecksum = this.generateChecksum();
    return this._checksum === expectedChecksum;
  }

  // Generate a new checksum and update the current one
  public updateChecksum(): void {
    this._checksum = this.generateChecksum();
  }

  // JSON serialization
  public toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      userId: this._userId,
      email: this._email,
      eventType: this._eventType,
      action: this._action,
      eventData: this._eventData,
      success: this._success,
      severity: this._severity,
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      sessionId: this._sessionId,
      requestId: this._requestId,
      resource: this._resource,
      checksum: this._checksum,
      createdAt: this._createdAt.toISOString(),
    };
  }

  // Create from JSON
  public static fromJSON(json: SecurityAuditLogJSON): SecurityAuditLog {
    const auditLog = new SecurityAuditLog({
      id: json.id,
      userId: json.userId,
      email: json.email,
      eventType: json.eventType as SecurityEventType,
      action: json.action as SecurityAction,
      eventData: json.eventData,
      success: json.success,
      severity: json.severity as SecuritySeverity,
      ipAddress: json.ipAddress,
      userAgent: json.userAgent,
      sessionId: json.sessionId,
      requestId: json.requestId,
      resource: json.resource,
      createdAt: new Date(json.createdAt),
    });

    // Preserve the original checksum for integrity verification
    auditLog._checksum = json.checksum;
    return auditLog;
  }

  // Factory method for creating different types of audit logs
  public static createAuthEvent(
    action: SecurityAction,
    options: {
      userId?: string;
      email?: string;
      success?: boolean;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestId?: string;
      eventData?: Record<string, unknown>;
    }
  ): SecurityAuditLog {
    return new SecurityAuditLog({
      eventType: SecurityEventType.AUTH,
      action,
      severity: options.success === false ? SecuritySeverity.WARN : SecuritySeverity.INFO,
      ...options,
    });
  }

  public static createSecurityEvent(
    action: SecurityAction,
    options: {
      userId?: string;
      email?: string;
      severity?: SecuritySeverity;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestId?: string;
      resource?: string;
      eventData?: Record<string, unknown>;
    }
  ): SecurityAuditLog {
    return new SecurityAuditLog({
      eventType: SecurityEventType.SECURITY,
      action,
      success: false, // Security events typically indicate issues
      severity: options.severity ?? SecuritySeverity.ERROR,
      ...options,
    });
  }

  // Private helper methods
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateChecksum(): string {
    const data = {
      id: this._id,
      userId: this._userId,
      email: this._email,
      eventType: this._eventType,
      action: this._action,
      success: this._success,
      severity: this._severity,
      ipAddress: this._ipAddress,
      sessionId: this._sessionId,
      requestId: this._requestId,
      resource: this._resource,
      createdAt: this._createdAt.toISOString(),
    };

    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(dataString).digest('hex');
  }

  private isEventTypeActionCompatible(): boolean {
    const authActions = [
      SecurityAction.LOGIN, SecurityAction.LOGOUT, SecurityAction.LOGIN_FAILED,
      SecurityAction.LOGIN_LOCKED, SecurityAction.SESSION_CREATED, 
      SecurityAction.SESSION_EXPIRED, SecurityAction.SESSION_TERMINATED,
      SecurityAction.PASSWORD_RESET_REQUESTED, SecurityAction.PASSWORD_RESET_COMPLETED,
      SecurityAction.PASSWORD_CHANGED, SecurityAction.PASSWORD_RESET_FAILED,
      SecurityAction.TWO_FACTOR_ENABLED, SecurityAction.TWO_FACTOR_DISABLED,
      SecurityAction.TWO_FACTOR_VERIFIED, SecurityAction.TWO_FACTOR_FAILED,
      SecurityAction.EMAIL_VERIFICATION_SENT, SecurityAction.EMAIL_VERIFIED,
      SecurityAction.EMAIL_VERIFICATION_FAILED
    ];

    const userMgmtActions = [
      SecurityAction.USER_CREATED, SecurityAction.USER_UPDATED,
      SecurityAction.USER_DELETED, SecurityAction.USER_ACTIVATED,
      SecurityAction.USER_DEACTIVATED
    ];

    const securityActions = [
      SecurityAction.SUSPICIOUS_ACTIVITY, SecurityAction.RATE_LIMIT_EXCEEDED,
      SecurityAction.UNAUTHORIZED_ACCESS, SecurityAction.PERMISSION_DENIED
    ];

    const dataAccessActions = [
      SecurityAction.DATA_VIEWED, SecurityAction.DATA_EXPORTED,
      SecurityAction.DATA_IMPORTED
    ];

    const systemActions = [
      SecurityAction.SYSTEM_CONFIG_CHANGED, SecurityAction.BACKUP_CREATED,
      SecurityAction.MAINTENANCE_MODE
    ];

    switch (this._eventType) {
      case SecurityEventType.AUTH:
        return authActions.includes(this._action);
      case SecurityEventType.USER_MGMT:
        return userMgmtActions.includes(this._action);
      case SecurityEventType.SECURITY:
        return securityActions.includes(this._action);
      case SecurityEventType.DATA_ACCESS:
        return dataAccessActions.includes(this._action);
      case SecurityEventType.SYSTEM:
        return systemActions.includes(this._action);
      default:
        return false;
    }
  }
}