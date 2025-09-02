import { http, HttpResponse } from 'msw';
import { UserProfile, SocialLinks, UserPreferences } from '@/models/UserProfile';
import { AuthUser } from '@/models/AuthUser';

// Mock user data
export const mockUser = new AuthUser({
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  image: 'https://example.com/avatar.jpg',
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const mockProfile = new UserProfile({
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  bio: 'Test user bio',
  phoneNumber: '+1234567890',
  avatarUrl: 'https://example.com/avatar.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const mockAuditLogs = [
  {
    id: '1',
    userId: 'test-user-123',
    action: 'profile_updated',
    success: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    eventType: 'PROFILE_UPDATE',
    severity: 'INFO',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: 'test-user-123',
    action: 'avatar_uploaded',
    success: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    eventType: 'FILE_UPLOAD',
    severity: 'INFO',
    createdAt: new Date().toISOString(),
  },
];

export const handlers = [
  // Profile Actions
  http.post('/api/profile/get', () => {
    return HttpResponse.json({
      success: true,
      profile: mockProfile,
    });
  }),

  http.post('/api/profile/update', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      profile: Object.assign({}, mockProfile.toJSON(), body),
    });
  }),

  http.post('/api/profile/social-links', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      socialLinks: body,
    });
  }),

  http.post('/api/profile/preferences', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      preferences: body,
    });
  }),

  http.post('/api/profile/stats', () => {
    return HttpResponse.json({
      success: true,
      stats: {
        completeness: 85,
        linkedAccountsCount: 1,
        age: 34,
        lastUpdated: new Date().toISOString(),
        recommendations: [
          'Add more social media links',
          'Complete your bio section',
          'Verify your phone number',
        ],
      },
    });
  }),

  // File Upload
  http.post('/api/uploads/avatar', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return HttpResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Simulate file validation
    if (!file.type.startsWith('image/')) {
      return HttpResponse.json(
        { success: false, error: 'Invalid file type' },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      return HttpResponse.json(
        { success: false, error: 'File too large' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      url: `https://example.com/uploads/avatar-${Date.now()}.jpg`,
      filename: file.name,
      size: file.size,
      type: file.type,
    });
  }),

  http.delete('/api/uploads/avatar', () => {
    return HttpResponse.json({
      success: true,
    });
  }),

  // OAuth Actions
  http.post('/api/oauth/link', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      success: true,
      account: {
        provider: body?.provider || 'unknown',
        providerId: `${body?.provider || 'unknown'}-test-id`,
        email: `test@${body?.provider || 'unknown'}.com`,
        name: 'Test User',
        avatar: `https://example.com/${body?.provider || 'unknown'}-avatar.jpg`,
        linkedAt: new Date(),
      },
    });
  }),

  http.post('/api/oauth/unlink', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      success: true,
      provider: body?.provider,
    });
  }),

  // Security Audit Actions
  http.post('/api/security/audit-logs', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    return HttpResponse.json({
      success: true,
      data: mockAuditLogs.slice(0, limit),
      total: mockAuditLogs.length,
    });
  }),

  // Error scenarios for testing
  http.post('/api/profile/error', () => {
    return HttpResponse.json(
      { success: false, error: 'Test error' },
      { status: 500 }
    );
  }),

  http.post('/api/uploads/error', () => {
    return HttpResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }),

  // Rate limiting scenario
  http.post('/api/profile/rate-limited', () => {
    return HttpResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }),
];

export default handlers;