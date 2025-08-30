import { 
  SecurityAuditLog, 
  SecurityEventType, 
  SecurityAction, 
  SecuritySeverity,
  AuditLogFilter 
} from "@/models/SecurityAuditLog";
import { 
  SecurityAuditLogRepository, 
  SecurityAuditLogCreateData,
  PaginatedResult 
} from "@/repositories/SecurityAuditLogRepository";
import { headers } from "next/headers";

export interface AuditLogContext {
  userId?: string;
  email?: string;
  sessionId?: string;
  requestId?: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  eventData?: Record<string, unknown>;
}

export interface RetentionPolicy {
  defaultRetentionDays: number;
  severityRetentionDays: {
    INFO: number;
    WARN: number;
    ERROR: number;
    CRITICAL: number;
  };
  eventTypeRetentionDays: {
    AUTH: number;
    USER_MGMT: number;
    SECURITY: number;
    DATA_ACCESS: number;
    SYSTEM: number;
  };
}

export class SecurityAuditLogService {
  private repository: SecurityAuditLogRepository;
  private static instance: SecurityAuditLogService;
  private logQueue: SecurityAuditLogCreateData[] = [];
  private isProcessingQueue = false;
  private readonly batchSize = 100;
  private readonly flushInterval = 5000; // 5 seconds
  
  // Default retention policy
  private retentionPolicy: RetentionPolicy = {
    defaultRetentionDays: 365,
    severityRetentionDays: {
      INFO: 90,
      WARN: 180,
      ERROR: 365,
      CRITICAL: 1095, // 3 years
    },
    eventTypeRetentionDays: {
      AUTH: 180,
      USER_MGMT: 365,
      SECURITY: 1095, // 3 years for security events
      DATA_ACCESS: 365,
      SYSTEM: 365,
    },
  };

  private constructor() {
    this.repository = SecurityAuditLogRepository.getInstance();
    this.startQueueProcessor();
  }

  public static getInstance(): SecurityAuditLogService {
    if (!SecurityAuditLogService.instance) {
      SecurityAuditLogService.instance = new SecurityAuditLogService();
    }
    return SecurityAuditLogService.instance;
  }

  // Main logging methods
  public async logAuthEvent(
    action: SecurityAction,
    context: AuditLogContext,
    success: boolean = true
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.AUTH,
      action,
      success,
      severity: success ? SecuritySeverity.INFO : SecuritySeverity.WARN,
      ...context,
    });
  }

  public async logSecurityEvent(
    action: SecurityAction,
    context: AuditLogContext,
    severity: SecuritySeverity = SecuritySeverity.ERROR
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.SECURITY,
      action,
      success: false, // Security events typically indicate issues
      severity,
      ...context,
    });
  }

  public async logUserManagementEvent(
    action: SecurityAction,
    context: AuditLogContext,
    success: boolean = true
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.USER_MGMT,
      action,
      success,
      severity: SecuritySeverity.INFO,
      ...context,
    });
  }

  public async logDataAccessEvent(
    action: SecurityAction,
    context: AuditLogContext,
    success: boolean = true
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.DATA_ACCESS,
      action,
      success,
      severity: SecuritySeverity.INFO,
      ...context,
    });
  }

  public async logSystemEvent(
    action: SecurityAction,
    context: AuditLogContext,
    severity: SecuritySeverity = SecuritySeverity.INFO
  ): Promise<void> {
    await this.logEvent({
      eventType: SecurityEventType.SYSTEM,
      action,
      success: true,
      severity,
      ...context,
    });
  }

  // Core logging method
  public async logEvent(data: {
    eventType: SecurityEventType;
    action: SecurityAction;
    success?: boolean;
    severity?: SecuritySeverity;
    userId?: string;
    email?: string;
    sessionId?: string;
    requestId?: string;
    resource?: string;
    ipAddress?: string;
    userAgent?: string;
    eventData?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Extract request context if not provided
      const context = await this.extractRequestContext();
      
      // Create audit log with enhanced context
      const auditLog = new SecurityAuditLog({
        eventType: data.eventType,
        action: data.action,
        success: data.success ?? true,
        severity: data.severity ?? SecuritySeverity.INFO,
        userId: data.userId,
        email: data.email,
        sessionId: data.sessionId ?? context.sessionId,
        requestId: data.requestId ?? context.requestId,
        resource: data.resource,
        ipAddress: data.ipAddress ?? context.ipAddress,
        userAgent: data.userAgent ?? context.userAgent,
        eventData: {
          ...data.eventData,
          timestamp: new Date().toISOString(),
          source: 'SecurityAuditLogService',
        },
      });

      // Validate the audit log
      const validation = auditLog.validate();
      if (!validation.isValid) {
        console.error('Invalid audit log:', validation.errors);
        return;
      }

      // Add to queue for batch processing
      this.addToQueue({
        userId: auditLog.userId,
        email: auditLog.email,
        eventType: auditLog.eventType,
        action: auditLog.action,
        eventData: auditLog.eventData,
        success: auditLog.success,
        severity: auditLog.severity,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        sessionId: auditLog.sessionId,
        requestId: auditLog.requestId,
        resource: auditLog.resource,
        checksum: auditLog.checksum,
      });

    } catch (error) {
      console.error('Failed to log security event:', error);
      // In case of error, we might want to use a fallback logging mechanism
    }
  }

  // Convenience methods for common security events
  public async logSuccessfulLogin(userId: string, email: string, context?: Partial<AuditLogContext>): Promise<void> {
    await this.logAuthEvent(SecurityAction.LOGIN, {
      userId,
      email,
      ...context,
    });
  }

  public async logFailedLogin(email: string, reason: string, context?: Partial<AuditLogContext>): Promise<void> {
    await this.logAuthEvent(SecurityAction.LOGIN_FAILED, {
      email,
      eventData: { reason },
      ...context,
    }, false);
  }

  public async logPasswordReset(email: string, success: boolean, context?: Partial<AuditLogContext>): Promise<void> {
    await this.logAuthEvent(
      success ? SecurityAction.PASSWORD_RESET_COMPLETED : SecurityAction.PASSWORD_RESET_FAILED,
      {
        email,
        ...context,
      },
      success
    );
  }

  public async logSuspiciousActivity(
    reason: string,
    severity: SecuritySeverity = SecuritySeverity.ERROR,
    context?: Partial<AuditLogContext>
  ): Promise<void> {
    await this.logSecurityEvent(SecurityAction.SUSPICIOUS_ACTIVITY, {
      eventData: { reason },
      ...context,
    }, severity);
  }

  public async logRateLimitExceeded(
    action: string,
    context?: Partial<AuditLogContext>
  ): Promise<void> {
    await this.logSecurityEvent(SecurityAction.RATE_LIMIT_EXCEEDED, {
      eventData: { limitedAction: action },
      ...context,
    }, SecuritySeverity.WARN);
  }

  // Query methods
  public async getAuditLogs(filter: AuditLogFilter = {}): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.repository.findMany(filter);
  }

  public async getAuditLogsByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.repository.findByUserId(userId, options);
  }

  public async getFailedLogins(options?: {
    ipAddress?: string;
    email?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.repository.findFailedLogins(options);
  }

  public async getSuspiciousActivity(options?: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.repository.findSuspiciousActivity(options);
  }

  public async getAuditStats(filter: Omit<AuditLogFilter, 'limit' | 'offset'> = {}): Promise<{
    total: number;
    successful: number;
    failed: number;
    byEventType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentActivity: SecurityAuditLog[];
  }> {
    return this.repository.getAuditStats(filter);
  }

  // Integrity verification
  public async verifyAuditLogIntegrity(ids: string[]): Promise<{
    verified: string[];
    corrupted: string[];
  }> {
    return this.repository.verifyIntegrity(ids);
  }

  // Retention policy management
  public setRetentionPolicy(policy: Partial<RetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
  }

  public getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  public async cleanupExpiredLogs(): Promise<number> {
    const now = new Date();
    let totalDeleted = 0;

    // Clean up by severity
    for (const [severity, days] of Object.entries(this.retentionPolicy.severityRetentionDays)) {
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const deletedBySeverity = await this.repository.deleteOlderThan(cutoffDate);
      totalDeleted += deletedBySeverity;
    }

    return totalDeleted;
  }

  public async scheduleCleanup(): Promise<void> {
    // This would typically be called by a cron job or background task
    try {
      const deletedCount = await this.cleanupExpiredLogs();
      await this.logSystemEvent(
        SecurityAction.SYSTEM_CONFIG_CHANGED,
        {
          eventData: {
            action: 'audit_log_cleanup',
            deletedRecords: deletedCount,
          },
        },
        SecuritySeverity.INFO
      );
    } catch (error) {
      console.error('Failed to cleanup expired audit logs:', error);
    }
  }

  // Queue management for batch processing
  private addToQueue(data: SecurityAuditLogCreateData): void {
    this.logQueue.push(data);
    
    // Immediate flush if queue is full
    if (this.logQueue.length >= this.batchSize) {
      this.flushQueue();
    }
  }

  private startQueueProcessor(): void {
    // Flush queue every 5 seconds
    setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flushQueue();
      }
    }, this.flushInterval);
  }

  private async flushQueue(): Promise<void> {
    if (this.isProcessingQueue || this.logQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const batch = [...this.logQueue];
    this.logQueue = [];

    try {
      await this.repository.createMany(batch);
    } catch (error) {
      console.error('Failed to flush audit log queue:', error);
      // Put items back in queue for retry
      this.logQueue.unshift(...batch);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Force flush the queue (useful for testing or shutdown)
  public async forceFlushQueue(): Promise<void> {
    await this.flushQueue();
  }

  private async extractRequestContext(): Promise<{
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
  }> {
    try {
      const headersList = await headers();
      
      return {
        ipAddress: this.getClientIP(headersList),
        userAgent: headersList.get('user-agent') || undefined,
        requestId: headersList.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      };
    } catch (error) {
      // Headers might not be available in some contexts
      return {};
    }
  }

  private getClientIP(headersList: Headers): string | undefined {
    // Check various headers for the client IP address
    const possibleHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip', // Cloudflare
      'x-forwarded', 
      'forwarded-for',
      'forwarded'
    ];

    for (const header of possibleHeaders) {
      const value = headersList.get(header);
      if (value) {
        // Handle comma-separated IPs (x-forwarded-for can contain multiple IPs)
        const ips = value.split(',').map(ip => ip.trim());
        const firstPublicIP = ips.find(ip => this.isPublicIP(ip));
        return firstPublicIP || ips[0];
      }
    }

    return undefined;
  }

  private isPublicIP(ip: string): boolean {
    // Basic check for public vs private IP addresses
    if (ip.startsWith('127.') || ip.startsWith('10.') || 
        ip.startsWith('192.168.') || ip.startsWith('172.')) {
      return false;
    }
    return true;
  }
}