import { prisma } from '@/lib/prisma';
import { Session } from '@/models/Session';

export class SessionRepository {
  private static instance: SessionRepository;

  private constructor() {}

  public static getInstance(): SessionRepository {
    if (!SessionRepository.instance) {
      SessionRepository.instance = new SessionRepository();
    }
    return SessionRepository.instance;
  }

  // Create new session
  public async create(session: Session): Promise<Session> {
    const data = await prisma.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        token: session.token,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isActive: session.isActive
      }
    });
    
    return Session.fromPrismaModel(data);
  }

  // Find session by token
  public async findByToken(token: string): Promise<Session | null> {
    const data = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true
          }
        }
      }
    });
    
    return data ? Session.fromPrismaModel(data) : null;
  }

  // Find session by ID
  public async findById(id: string): Promise<Session | null> {
    const data = await prisma.session.findUnique({
      where: { id }
    });
    
    return data ? Session.fromPrismaModel(data) : null;
  }

  // Find all sessions for a user
  public async findByUserId(userId: string, activeOnly: boolean = true): Promise<Session[]> {
    const whereClause: any = { userId };
    if (activeOnly) {
      whereClause.isActive = true;
      whereClause.expiresAt = { gte: new Date() };
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    return sessions.map(Session.fromPrismaModel);
  }

  // Update session
  public async update(session: Session): Promise<Session> {
    const data = await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: session.expiresAt,
        isActive: session.isActive,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        updatedAt: new Date()
      }
    });
    
    return Session.fromPrismaModel(data);
  }

  // Extend session expiration
  public async extend(token: string, hours: number = 24): Promise<Session | null> {
    try {
      const data = await prisma.session.update({
        where: { 
          token,
          isActive: true,
          expiresAt: { gte: new Date() }
        },
        data: {
          expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
          updatedAt: new Date()
        }
      });
      
      return Session.fromPrismaModel(data);
    } catch {
      return null;
    }
  }

  // Revoke session by token
  public async revokeByToken(token: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { token },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  // Revoke session by ID
  public async revokeById(id: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  // Revoke all sessions for a user
  public async revokeAllByUserId(userId: string, exceptToken?: string): Promise<number> {
    const whereClause: any = { 
      userId,
      isActive: true
    };

    if (exceptToken) {
      whereClause.token = { not: exceptToken };
    }

    const result = await prisma.session.updateMany({
      where: whereClause,
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
    
    return result.count;
  }

  // Delete session permanently
  public async deleteByToken(token: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { token }
      });
      return true;
    } catch {
      return false;
    }
  }

  // Delete session by ID
  public async deleteById(id: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id }
      });
      return true;
    } catch {
      return false;
    }
  }

  // Clean up expired sessions
  public async cleanupExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false }
        ]
      }
    });
    
    return result.count;
  }

  // Clean up old inactive sessions (older than 30 days)
  public async cleanupOldInactive(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.session.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: thirtyDaysAgo }
      }
    });
    
    return result.count;
  }

  // Get session statistics
  public async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    inactiveSessions: number;
  }> {
    const now = new Date();

    const [total, active, expired, inactive] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({
        where: {
          isActive: true,
          expiresAt: { gte: now }
        }
      }),
      prisma.session.count({
        where: {
          expiresAt: { lt: now }
        }
      }),
      prisma.session.count({
        where: {
          isActive: false
        }
      })
    ]);

    return {
      totalSessions: total,
      activeSessions: active,
      expiredSessions: expired,
      inactiveSessions: inactive
    };
  }

  // Check if session exists and is valid
  public async isValidSession(token: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: {
        token,
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      select: { id: true }
    });
    
    return !!session;
  }

  // Get recent sessions for a user (for security purposes)
  public async getRecentSessions(
    userId: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    createdAt: Date;
    ipAddress?: string;
    userAgent?: string;
    isActive: boolean;
    isCurrent?: boolean;
  }>> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        token: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
        isActive: true,
        expiresAt: true
      }
    });

    return sessions.map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      isActive: session.isActive && session.expiresAt > new Date(),
      isCurrent: false // This will be set by the service layer
    }));
  }

  // Update session metadata (IP, User Agent)
  public async updateMetadata(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      const updates: any = { updatedAt: new Date() };
      if (ipAddress) updates.ipAddress = ipAddress;
      if (userAgent) updates.userAgent = userAgent;

      await prisma.session.update({
        where: { token },
        data: updates
      });
      
      return true;
    } catch {
      return false;
    }
  }

  // Count active sessions for a user
  public async countActiveByUserId(userId: string): Promise<number> {
    return prisma.session.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { gte: new Date() }
      }
    });
  }
}