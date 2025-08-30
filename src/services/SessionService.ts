import { Session } from '@/models/Session';
import { SessionRepository } from '@/repositories/SessionRepository';
import { AuthRepository } from '@/repositories/AuthRepository';

interface SessionWithUser {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
  };
}

export class SessionService {
  private sessionRepository: SessionRepository;
  private authRepository: AuthRepository;
  private static instance: SessionService;

  private constructor() {
    this.sessionRepository = SessionRepository.getInstance();
    this.authRepository = AuthRepository.getInstance();
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // Create new session
  public async createSession(
    userId: string,
    expirationHours: number = 24,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    // Verify user exists and is active
    const user = await this.authRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new Error('Invalid user or user is inactive');
    }

    // Create session
    const session = Session.create(userId, expirationHours, ipAddress, userAgent);
    
    // Validate session before saving
    const validation = session.validate();
    if (!validation.isValid) {
      throw new Error(`Session validation failed: ${validation.errors.join(', ')}`);
    }

    // Save to database
    return await this.sessionRepository.create(session);
  }

  // Validate session by token
  public async validateSession(token: string): Promise<SessionWithUser | null> {
    if (!token) return null;

    const session = await this.sessionRepository.findByToken(token);
    if (!session || !session.isValid()) {
      return null;
    }

    // Get user details
    const user = await this.authRepository.findById(session.userId);
    if (!user || !user.isActive) {
      // User is inactive, revoke session
      await this.revokeSession(token);
      return null;
    }

    // Check if session needs refresh (auto-extend if less than 25% time remaining)
    if (session.needsRefresh()) {
      await this.extendSession(token);
    }

    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive
      }
    };
  }

  // Extend session expiration
  public async extendSession(token: string, hours: number = 24): Promise<Session | null> {
    return await this.sessionRepository.extend(token, hours);
  }

  // Revoke session
  public async revokeSession(token: string): Promise<boolean> {
    return await this.sessionRepository.revokeByToken(token);
  }

  // Revoke session by ID
  public async revokeSessionById(id: string): Promise<boolean> {
    return await this.sessionRepository.revokeById(id);
  }

  // Revoke all user sessions except current
  public async revokeAllUserSessions(userId: string, exceptToken?: string): Promise<number> {
    return await this.sessionRepository.revokeAllByUserId(userId, exceptToken);
  }

  // Get user sessions
  public async getUserSessions(
    userId: string,
    currentToken?: string,
    activeOnly: boolean = true
  ): Promise<Array<{
    id: string;
    createdAt: Date;
    ipAddress?: string;
    userAgent?: string;
    isActive: boolean;
    isCurrent: boolean;
    timeRemaining?: string;
  }>> {
    const sessions = await this.sessionRepository.getRecentSessions(userId);
    
    return sessions.map(session => ({
      ...session,
      isCurrent: currentToken ? session.id === currentToken : false,
      timeRemaining: session.isActive ? this.formatTimeRemaining(session.createdAt) : undefined
    }));
  }

  // Refresh session (create new token, revoke old)
  public async refreshSession(
    oldToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session | null> {
    const currentSession = await this.sessionRepository.findByToken(oldToken);
    if (!currentSession || !currentSession.isValid()) {
      return null;
    }

    // Create new session
    const newSession = await this.createSession(
      currentSession.userId,
      24, // Default 24 hours
      ipAddress,
      userAgent
    );

    // Revoke old session
    await this.revokeSession(oldToken);

    return newSession;
  }

  // Clean up expired sessions
  public async cleanupExpiredSessions(): Promise<number> {
    return await this.sessionRepository.cleanupExpired();
  }

  // Clean up old inactive sessions
  public async cleanupOldSessions(): Promise<number> {
    return await this.sessionRepository.cleanupOldInactive();
  }

  // Get session statistics
  public async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    inactiveSessions: number;
  }> {
    return await this.sessionRepository.getStats();
  }

  // Update session metadata
  public async updateSessionMetadata(
    token: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<boolean> {
    return await this.sessionRepository.updateMetadata(token, ipAddress, userAgent);
  }

  // Check if user has reached session limit
  public async checkSessionLimit(userId: string, maxSessions: number = 5): Promise<boolean> {
    const activeSessionCount = await this.sessionRepository.countActiveByUserId(userId);
    return activeSessionCount < maxSessions;
  }

  // Enforce session limit (revoke oldest sessions if over limit)
  public async enforceSessionLimit(userId: string, maxSessions: number = 5): Promise<void> {
    const activeSessions = await this.sessionRepository.findByUserId(userId, true);
    
    if (activeSessions.length > maxSessions) {
      // Sort by creation date and revoke oldest sessions
      const sortedSessions = activeSessions.sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      );
      
      const sessionsToRevoke = sortedSessions.slice(0, activeSessions.length - maxSessions);
      
      for (const session of sessionsToRevoke) {
        await this.revokeSessionById(session.id);
      }
    }
  }

  // Validate session for API access
  public async validateApiSession(token: string): Promise<{
    valid: boolean;
    userId?: string;
    user?: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }> {
    const sessionWithUser = await this.validateSession(token);
    
    if (!sessionWithUser) {
      return { valid: false };
    }

    const user = await this.authRepository.findById(sessionWithUser.userId);
    if (!user) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  // Helper method to format time remaining
  private formatTimeRemaining(createdAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`;
    } else {
      return `${diffMinutes}m ago`;
    }
  }

  // Sync external session (for OAuth providers like BetterAuth)
  public async syncExternalSession(externalSession: any): Promise<void> {
    // This method can be used to sync sessions created by BetterAuth
    // with our internal session management system
    if (externalSession.userId && externalSession.sessionToken) {
      const existingSession = await this.sessionRepository.findByToken(externalSession.sessionToken);
      
      if (!existingSession) {
        // Create internal session record
        const session = new Session({
          id: crypto.randomUUID(),
          userId: externalSession.userId,
          token: externalSession.sessionToken,
          expiresAt: new Date(externalSession.expires),
          createdAt: new Date(externalSession.createdAt || Date.now()),
          isActive: true
        });
        
        await this.sessionRepository.create(session);
      }
    }
  }

  // Security: Log suspicious session activity
  public async logSuspiciousActivity(
    sessionId: string,
    activity: string,
    details?: any
  ): Promise<void> {
    // In a real application, you would log this to a security audit system
    console.warn(`[SECURITY] Suspicious activity on session ${sessionId}: ${activity}`, details);
    
    // You could implement additional security measures here:
    // - Revoke the session
    // - Notify the user
    // - Rate limit the IP
    // - etc.
  }

  // Batch operations for cleanup jobs
  public async performMaintenance(): Promise<{
    expiredCleaned: number;
    oldInactiveCleaned: number;
    totalCleaned: number;
  }> {
    const [expiredCleaned, oldInactiveCleaned] = await Promise.all([
      this.cleanupExpiredSessions(),
      this.cleanupOldSessions()
    ]);

    return {
      expiredCleaned,
      oldInactiveCleaned,
      totalCleaned: expiredCleaned + oldInactiveCleaned
    };
  }
}