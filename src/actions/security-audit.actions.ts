"use server";

import { SecurityAuditLogService } from "@/services/SecurityAuditLogService";
import { SecurityEventType, SecurityAction, SecuritySeverity } from "@/models/SecurityAuditLog";
import { AuthService } from "@/services/AuthService";
import { createSafeActionClient } from "next-safe-action";
import { cookies, headers } from "next/headers";
import { z } from "zod";

// Create safe action client
const action = createSafeActionClient({
  handleServerError: (e) => {
    console.error("Security audit action error:", e);
    return e.message || "An unexpected error occurred";
  },
});

// Auth middleware for protected actions
const authAction = action.use(async ({ next }) => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const authService = AuthService.getInstance();
  const user = await authService.getUserBySession(sessionToken);

  if (!user) {
    cookieStore.delete("session");
    throw new Error("Invalid session");
  }

  return next({ ctx: { user, sessionToken } });
});

// Admin-only middleware 
const adminAction = authAction.use(async ({ next, ctx }) => {
  if (ctx.user.role !== "ADMIN" && ctx.user.role !== "SUPPORT") {
    throw new Error("Insufficient permissions");
  }

  return next({ ctx });
});

// Helper to get client IP and User-Agent
async function getClientInfo() {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || undefined;
  const forwarded = headersList.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : headersList.get("x-real-ip") ||
      headersList.get("remote-addr") ||
      undefined;

  return { userAgent, ipAddress };
}

// Get Security Audit Logs Action
export const getSecurityAuditLogsAction = adminAction
  .schema(
    z.object({
      userId: z.string().optional(),
      email: z.string().optional(),
      eventType: z.enum(['AUTH', 'USER_MGMT', 'SECURITY', 'DATA_ACCESS', 'SYSTEM']).optional(),
      action: z.enum([
        'login', 'logout', 'login_failed', 'login_locked', 'session_created', 'session_expired', 'session_terminated',
        'password_reset_requested', 'password_reset_completed', 'password_changed', 'password_reset_failed',
        'two_factor_enabled', 'two_factor_disabled', 'two_factor_verified', 'two_factor_failed',
        'user_created', 'user_updated', 'user_deleted', 'user_activated', 'user_deactivated',
        'email_verification_sent', 'email_verified', 'email_verification_failed',
        'suspicious_activity', 'rate_limit_exceeded', 'unauthorized_access', 'permission_denied',
        'data_viewed', 'data_exported', 'data_imported',
        'system_config_changed', 'backup_created', 'maintenance_mode'
      ]).optional(),
      success: z.boolean().optional(),
      severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).optional(),
      ipAddress: z.string().optional(),
      sessionId: z.string().optional(),
      requestId: z.string().optional(),
      resource: z.string().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      limit: z.number().min(1).max(1000).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the audit log access
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logDataAccessEvent(
      SecurityAction.DATA_VIEWED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "security_audit_logs",
        ipAddress,
        userAgent,
        eventData: {
          filters: parsedInput,
          accessedBy: ctx.user.id,
        },
      }
    );

    const filter = {
      ...parsedInput,
      dateFrom: parsedInput.dateFrom ? new Date(parsedInput.dateFrom) : undefined,
      dateTo: parsedInput.dateTo ? new Date(parsedInput.dateTo) : undefined,
      eventType: parsedInput.eventType as SecurityEventType | undefined,
      action: parsedInput.action as SecurityAction | undefined,
      severity: parsedInput.severity as SecuritySeverity | undefined,
    };

    const result = await auditService.getAuditLogs(filter);

    return {
      success: true,
      data: result.data.map(log => log.toJSON()),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  });

// Get User's Own Audit Logs Action
export const getUserAuditLogsAction = authAction
  .schema(
    z.object({
      limit: z.number().min(1).max(100).optional().default(25),
      offset: z.number().min(0).optional().default(0),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    const result = await auditService.getAuditLogsByUserId(ctx.user.id, parsedInput);

    return {
      success: true,
      data: result.data.map(log => ({
        id: log.id,
        eventType: log.eventType,
        action: log.action,
        success: log.success,
        severity: log.severity,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
        eventData: log.eventData,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  });

// Get Audit Statistics Action
export const getAuditStatsAction = adminAction
  .schema(
    z.object({
      userId: z.string().optional(),
      eventType: z.enum(['AUTH', 'USER_MGMT', 'SECURITY', 'DATA_ACCESS', 'SYSTEM']).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the stats access
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logDataAccessEvent(
      SecurityAction.DATA_VIEWED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "audit_statistics",
        ipAddress,
        userAgent,
        eventData: {
          filters: parsedInput,
          accessedBy: ctx.user.id,
        },
      }
    );

    const filter = {
      ...parsedInput,
      dateFrom: parsedInput.dateFrom ? new Date(parsedInput.dateFrom) : undefined,
      dateTo: parsedInput.dateTo ? new Date(parsedInput.dateTo) : undefined,
      eventType: parsedInput.eventType as SecurityEventType | undefined,
    };

    const stats = await auditService.getAuditStats(filter);

    return {
      success: true,
      stats: {
        ...stats,
        recentActivity: stats.recentActivity.map(log => log.toJSON()),
      },
    };
  });

// Get Failed Logins Action
export const getFailedLoginsAction = adminAction
  .schema(
    z.object({
      ipAddress: z.string().optional(),
      email: z.string().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      limit: z.number().min(1).max(1000).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the access
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logDataAccessEvent(
      SecurityAction.DATA_VIEWED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "failed_logins",
        ipAddress,
        userAgent,
        eventData: {
          filters: parsedInput,
          accessedBy: ctx.user.id,
        },
      }
    );

    const options = {
      ...parsedInput,
      dateFrom: parsedInput.dateFrom ? new Date(parsedInput.dateFrom) : undefined,
      dateTo: parsedInput.dateTo ? new Date(parsedInput.dateTo) : undefined,
    };

    const result = await auditService.getFailedLogins(options);

    return {
      success: true,
      data: result.data.map(log => log.toJSON()),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  });

// Get Suspicious Activity Action
export const getSuspiciousActivityAction = adminAction
  .schema(
    z.object({
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      limit: z.number().min(1).max(1000).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the access
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logDataAccessEvent(
      SecurityAction.DATA_VIEWED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "suspicious_activity",
        ipAddress,
        userAgent,
        eventData: {
          filters: parsedInput,
          accessedBy: ctx.user.id,
        },
      }
    );

    const options = {
      ...parsedInput,
      dateFrom: parsedInput.dateFrom ? new Date(parsedInput.dateFrom) : undefined,
      dateTo: parsedInput.dateTo ? new Date(parsedInput.dateTo) : undefined,
    };

    const result = await auditService.getSuspiciousActivity(options);

    return {
      success: true,
      data: result.data.map(log => log.toJSON()),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  });

// Verify Audit Log Integrity Action
export const verifyAuditIntegrityAction = adminAction
  .schema(
    z.object({
      logIds: z.array(z.string()).min(1).max(100),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the integrity verification
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logSecurityEvent(
      SecurityAction.SYSTEM_CONFIG_CHANGED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "audit_log_integrity",
        ipAddress,
        userAgent,
        eventData: {
          action: 'integrity_verification',
          logIds: parsedInput.logIds,
          verifiedBy: ctx.user.id,
        },
      },
      SecuritySeverity.INFO
    );

    const result = await auditService.verifyAuditLogIntegrity(parsedInput.logIds);

    return {
      success: true,
      verification: result,
    };
  });

// Export Audit Logs Action
export const exportAuditLogsAction = adminAction
  .schema(
    z.object({
      userId: z.string().optional(),
      eventType: z.enum(['AUTH', 'USER_MGMT', 'SECURITY', 'DATA_ACCESS', 'SYSTEM']).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      format: z.enum(['json', 'csv']).default('json'),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the export action
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logDataAccessEvent(
      SecurityAction.DATA_EXPORTED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "security_audit_logs",
        ipAddress,
        userAgent,
        eventData: {
          exportFormat: parsedInput.format,
          filters: parsedInput,
          exportedBy: ctx.user.id,
        },
      }
    );

    const filter = {
      ...parsedInput,
      dateFrom: parsedInput.dateFrom ? new Date(parsedInput.dateFrom) : undefined,
      dateTo: parsedInput.dateTo ? new Date(parsedInput.dateTo) : undefined,
      eventType: parsedInput.eventType as SecurityEventType | undefined,
      limit: 10000, // Max export limit
    };

    const result = await auditService.getAuditLogs(filter);
    const exportData = result.data.map(log => log.toJSON());

    if (parsedInput.format === 'csv') {
      // Convert to CSV format
      const headers = [
        'id', 'userId', 'email', 'eventType', 'action', 'success', 'severity',
        'ipAddress', 'userAgent', 'sessionId', 'requestId', 'resource', 'createdAt'
      ];
      
      const csvRows = [
        headers.join(','),
        ...exportData.map(log => 
          headers.map(header => {
            const value = log[header as keyof typeof log];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          }).join(',')
        )
      ];

      return {
        success: true,
        data: csvRows.join('\n'),
        format: 'csv',
        count: exportData.length,
      };
    }

    return {
      success: true,
      data: exportData,
      format: 'json',
      count: exportData.length,
    };
  });

// Cleanup Old Audit Logs Action (Admin only)
export const cleanupAuditLogsAction = adminAction
  .schema(
    z.object({
      confirm: z.literal(true),
      dryRun: z.boolean().optional().default(true),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();

    // Log the cleanup attempt
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logSystemEvent(
      SecurityAction.SYSTEM_CONFIG_CHANGED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "audit_log_cleanup",
        ipAddress,
        userAgent,
        eventData: {
          action: 'cleanup_initiation',
          dryRun: parsedInput.dryRun,
          initiatedBy: ctx.user.id,
        },
      },
      SecuritySeverity.WARN
    );

    if (parsedInput.dryRun) {
      // For dry run, just return what would be deleted without actually deleting
      const retentionPolicy = auditService.getRetentionPolicy();
      return {
        success: true,
        dryRun: true,
        message: "Dry run completed. No logs were deleted.",
        retentionPolicy,
        wouldDelete: "Use the actual cleanup action to see deletion counts",
      };
    }

    const deletedCount = await auditService.cleanupExpiredLogs();

    // Log the actual cleanup
    await auditService.logSystemEvent(
      SecurityAction.SYSTEM_CONFIG_CHANGED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "audit_log_cleanup",
        ipAddress,
        userAgent,
        eventData: {
          action: 'cleanup_completed',
          deletedCount,
          completedBy: ctx.user.id,
        },
      },
      SecuritySeverity.INFO
    );

    return {
      success: true,
      dryRun: false,
      deletedCount,
      message: `Successfully cleaned up ${deletedCount} expired audit logs.`,
    };
  });

// Get Audit Logs by Request ID (for debugging and correlation)
export const getAuditLogsByRequestAction = adminAction
  .schema(
    z.object({
      requestId: z.string().min(1, "Request ID is required"),
    })
  )
  .action(async ({ parsedInput, ctx }) => {
    const auditService = SecurityAuditLogService.getInstance();
    const repository = auditService['repository']; // Access private property for this specific method

    // Log the request ID lookup
    const { ipAddress, userAgent } = await getClientInfo();
    await auditService.logDataAccessEvent(
      SecurityAction.DATA_VIEWED,
      {
        userId: ctx.user.id,
        email: ctx.user.email,
        resource: "audit_logs_by_request",
        ipAddress,
        userAgent,
        eventData: {
          requestId: parsedInput.requestId,
          accessedBy: ctx.user.id,
        },
      }
    );

    const logs = await repository.findByRequestId(parsedInput.requestId);

    return {
      success: true,
      data: logs.map(log => log.toJSON()),
      count: logs.length,
      requestId: parsedInput.requestId,
    };
  });