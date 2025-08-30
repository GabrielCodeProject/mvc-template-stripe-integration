import { SecurityAuditLog, SecurityEventType, SecurityAction, SecuritySeverity, AuditLogFilter } from "@/models/SecurityAuditLog";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SecurityAuditLogCreateData {
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
  checksum?: string;
}

export class SecurityAuditLogRepository {
  private static instance: SecurityAuditLogRepository;

  private constructor() {}

  public static getInstance(): SecurityAuditLogRepository {
    if (!SecurityAuditLogRepository.instance) {
      SecurityAuditLogRepository.instance = new SecurityAuditLogRepository();
    }
    return SecurityAuditLogRepository.instance;
  }

  public async create(data: SecurityAuditLogCreateData): Promise<SecurityAuditLog> {
    const auditLog = await prisma.securityAuditLog.create({
      data: {
        userId: data.userId,
        email: data.email,
        eventType: data.eventType,
        action: data.action,
        eventData: data.eventData ? data.eventData as Prisma.JsonObject : undefined,
        success: data.success ?? true,
        severity: data.severity ?? SecuritySeverity.INFO,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        requestId: data.requestId,
        resource: data.resource,
        checksum: data.checksum,
      },
    });

    return this.toDomainModel(auditLog);
  }

  public async findById(id: string): Promise<SecurityAuditLog | null> {
    const auditLog = await prisma.securityAuditLog.findUnique({
      where: { id },
      include: { user: true },
    });

    return auditLog ? this.toDomainModel(auditLog) : null;
  }

  public async findMany(filter: AuditLogFilter = {}): Promise<PaginatedResult<SecurityAuditLog>> {
    const where = this.buildWhereClause(filter);
    const orderBy = { createdAt: 'desc' as const };
    
    const page = Math.max(1, Math.floor((filter.offset || 0) / (filter.limit || 50)) + 1);
    const pageSize = Math.min(filter.limit || 50, 1000); // Max 1000 records per page
    const skip = (page - 1) * pageSize;

    const [auditLogs, total] = await Promise.all([
      prisma.securityAuditLog.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: { user: true },
      }),
      prisma.securityAuditLog.count({ where }),
    ]);

    return {
      data: auditLogs.map(this.toDomainModel),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  public async findByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      userId,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async findByEventType(eventType: SecurityEventType, options?: { limit?: number; offset?: number }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      eventType,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async findByAction(action: SecurityAction, options?: { limit?: number; offset?: number }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      action,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async findByIpAddress(ipAddress: string, options?: { limit?: number; offset?: number }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      ipAddress,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async findBySessionId(sessionId: string, options?: { limit?: number; offset?: number }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      sessionId,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async findByRequestId(requestId: string): Promise<SecurityAuditLog[]> {
    const auditLogs = await prisma.securityAuditLog.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });

    return auditLogs.map(this.toDomainModel);
  }

  public async findSuspiciousActivity(options?: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      eventType: SecurityEventType.SECURITY,
      severity: SecuritySeverity.ERROR,
      success: false,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async findFailedLogins(options?: {
    ipAddress?: string;
    email?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResult<SecurityAuditLog>> {
    return this.findMany({
      eventType: SecurityEventType.AUTH,
      action: SecurityAction.LOGIN_FAILED,
      success: false,
      ipAddress: options?.ipAddress,
      email: options?.email,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  public async getAuditStats(filter: Omit<AuditLogFilter, 'limit' | 'offset'> = {}): Promise<{
    total: number;
    successful: number;
    failed: number;
    byEventType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentActivity: SecurityAuditLog[];
  }> {
    const where = this.buildWhereClause(filter);

    const [
      total,
      successful,
      failed,
      eventTypeStats,
      severityStats,
      recentActivity
    ] = await Promise.all([
      prisma.securityAuditLog.count({ where }),
      prisma.securityAuditLog.count({ where: { ...where, success: true } }),
      prisma.securityAuditLog.count({ where: { ...where, success: false } }),
      prisma.securityAuditLog.groupBy({
        by: ['eventType'],
        where,
        _count: { eventType: true },
      }),
      prisma.securityAuditLog.groupBy({
        by: ['severity'],
        where,
        _count: { severity: true },
      }),
      prisma.securityAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: true },
      })
    ]);

    const byEventType = eventTypeStats.reduce((acc, stat) => {
      acc[stat.eventType] = stat._count.eventType;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = severityStats.reduce((acc, stat) => {
      acc[stat.severity] = stat._count.severity;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      successful,
      failed,
      byEventType,
      bySeverity,
      recentActivity: recentActivity.map(this.toDomainModel),
    };
  }

  public async deleteOlderThan(date: Date): Promise<number> {
    const result = await prisma.securityAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: date,
        },
      },
    });

    return result.count;
  }

  public async count(filter: Omit<AuditLogFilter, 'limit' | 'offset'> = {}): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.securityAuditLog.count({ where });
  }

  public async verifyIntegrity(ids: string[]): Promise<{
    verified: string[];
    corrupted: string[];
  }> {
    const auditLogs = await prisma.securityAuditLog.findMany({
      where: {
        id: { in: ids },
      },
    });

    const verified: string[] = [];
    const corrupted: string[] = [];

    for (const log of auditLogs) {
      const domainLog = this.toDomainModel(log);
      if (domainLog.verifyIntegrity()) {
        verified.push(log.id);
      } else {
        corrupted.push(log.id);
      }
    }

    return { verified, corrupted };
  }

  // Batch operations for performance
  public async createMany(data: SecurityAuditLogCreateData[]): Promise<number> {
    const result = await prisma.securityAuditLog.createMany({
      data: data.map(item => ({
        userId: item.userId,
        email: item.email,
        eventType: item.eventType,
        action: item.action,
        eventData: item.eventData ? item.eventData as Prisma.JsonObject : undefined,
        success: item.success ?? true,
        severity: item.severity ?? SecuritySeverity.INFO,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        sessionId: item.sessionId,
        requestId: item.requestId,
        resource: item.resource,
        checksum: item.checksum,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  // Helper methods
  private buildWhereClause(filter: AuditLogFilter): Prisma.SecurityAuditLogWhereInput {
    const where: Prisma.SecurityAuditLogWhereInput = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.email) {
      where.email = { contains: filter.email, mode: 'insensitive' };
    }

    if (filter.eventType) {
      where.eventType = filter.eventType;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (typeof filter.success === 'boolean') {
      where.success = filter.success;
    }

    if (filter.severity) {
      where.severity = filter.severity;
    }

    if (filter.ipAddress) {
      where.ipAddress = filter.ipAddress;
    }

    if (filter.sessionId) {
      where.sessionId = filter.sessionId;
    }

    if (filter.requestId) {
      where.requestId = filter.requestId;
    }

    if (filter.resource) {
      where.resource = { contains: filter.resource, mode: 'insensitive' };
    }

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) {
        where.createdAt.gte = filter.dateFrom;
      }
      if (filter.dateTo) {
        where.createdAt.lte = filter.dateTo;
      }
    }

    return where;
  }

  private toDomainModel(prismaAuditLog: {
    id: string;
    userId: string | null;
    email: string | null;
    eventType: string;
    action: string;
    eventData: Prisma.JsonValue | null;
    success: boolean;
    severity: string;
    ipAddress: string | null;
    userAgent: string | null;
    sessionId: string | null;
    requestId: string | null;
    resource: string | null;
    checksum: string | null;
    createdAt: Date;
    user?: any;
  }): SecurityAuditLog {
    return SecurityAuditLog.fromJSON({
      id: prismaAuditLog.id,
      userId: prismaAuditLog.userId || undefined,
      email: prismaAuditLog.email || undefined,
      eventType: prismaAuditLog.eventType,
      action: prismaAuditLog.action,
      eventData: prismaAuditLog.eventData ? 
        (prismaAuditLog.eventData as Record<string, unknown>) : undefined,
      success: prismaAuditLog.success,
      severity: prismaAuditLog.severity,
      ipAddress: prismaAuditLog.ipAddress || undefined,
      userAgent: prismaAuditLog.userAgent || undefined,
      sessionId: prismaAuditLog.sessionId || undefined,
      requestId: prismaAuditLog.requestId || undefined,
      resource: prismaAuditLog.resource || undefined,
      checksum: prismaAuditLog.checksum || undefined,
      createdAt: prismaAuditLog.createdAt.toISOString(),
    });
  }
}