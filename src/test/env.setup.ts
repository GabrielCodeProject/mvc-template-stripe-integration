// Environment setup for tests
// @ts-expect-error - NODE_ENV assignment for tests
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Database test environment
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// OAuth test credentials (fake ones for testing)
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';

// File upload configuration
process.env.UPLOAD_MAX_SIZE = '5242880'; // 5MB
process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

// Rate limiting configuration for tests
process.env.RATE_LIMIT_WINDOW = '900000'; // 15 minutes
process.env.RATE_LIMIT_MAX = '100';

// Email service (mock)
process.env.RESEND_API_KEY = 'test-resend-api-key';
process.env.FROM_EMAIL = 'test@example.com';

// Security settings
process.env.BCRYPT_ROUNDS = '10';
process.env.JWT_SECRET = 'test-jwt-secret';

// Feature flags for testing
process.env.ENABLE_OAUTH = 'true';
process.env.ENABLE_2FA = 'true';
process.env.ENABLE_FILE_UPLOAD = 'true';

// Disable telemetry and analytics in tests
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DISABLE_ANALYTICS = 'true';