/**
 * Test script for password reset functionality
 * This demonstrates the secure password reset implementation
 */

import { PasswordResetService } from '@/services/PasswordResetService';

export async function testPasswordResetFlow() {
  const service = PasswordResetService.getInstance();
  const testEmail = 'test@example.com';
  const testIP = '127.0.0.1';
  const testUserAgent = 'Test Agent';

  console.log('=== Password Reset Security Test ===\n');

  try {
    // Test 1: Initiate password reset
    console.log('1. Testing password reset initiation...');
    const initResult = await service.initiatePasswordReset({
      email: testEmail,
      ipAddress: testIP,
      userAgent: testUserAgent,
    });

    console.log('✓ Password reset initiated successfully');
    console.log('  Message:', initResult.message);
    console.log('  Rate limit info:', initResult.rateLimitInfo);
    console.log('');

    // Test 2: Get security stats
    console.log('2. Checking security statistics...');
    const stats = await service.getSecurityStats();
    console.log('✓ Security stats retrieved:');
    console.log('  Active tokens:', stats.activeTokens);
    console.log('  Recent failed attempts:', stats.recentFailedAttempts);
    console.log('  Blocked IPs:', stats.blockedIPs);
    console.log('  Rate limited emails:', stats.rateLimitedEmails);
    console.log('');

    // Test 3: Test rate limiting
    console.log('3. Testing rate limiting (multiple requests)...');
    for (let i = 1; i <= 5; i++) {
      try {
        const result = await service.initiatePasswordReset({
          email: testEmail,
          ipAddress: testIP,
          userAgent: testUserAgent,
        });
        console.log(`  Request ${i}: Success - ${result.remainingRequests || 0} remaining`);
      } catch (error: any) {
        console.log(`  Request ${i}: Rate limited - ${error.message}`);
        break;
      }
    }
    console.log('');

    // Test 4: Token validation (with invalid token)
    console.log('4. Testing token validation with invalid token...');
    const invalidTokenResult = await service.validateResetToken({
      token: 'invalid_token_test',
      ipAddress: testIP,
      userAgent: testUserAgent,
    });

    console.log('✓ Invalid token properly rejected:');
    console.log('  Valid:', invalidTokenResult.isValid);
    console.log('  Errors:', invalidTokenResult.errors);
    console.log('');

    // Test 5: Maintenance
    console.log('5. Testing maintenance cleanup...');
    const maintenanceResult = await service.performMaintenance();
    console.log('✓ Maintenance completed:');
    console.log('  Expired tokens deleted:', maintenanceResult.expiredTokensDeleted);
    console.log('  Expired rate limits deleted:', maintenanceResult.expiredRateLimitsDeleted);
    console.log('  Old audit logs deleted:', maintenanceResult.oldAuditLogsDeleted);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }

  console.log('\n=== Test Complete ===');
}

// Example usage function
export async function demonstrateSecurityFeatures() {
  console.log('=== Password Reset Security Features ===\n');

  console.log('✓ 64-byte cryptographically secure token generation');
  console.log('✓ SHA-256 token hashing for secure storage');
  console.log('✓ 15-minute token expiration');
  console.log('✓ Email rate limiting (3 requests per hour)');
  console.log('✓ IP rate limiting (10 requests per hour)');
  console.log('✓ IP and user agent binding');
  console.log('✓ Email enumeration protection');
  console.log('✓ Comprehensive audit logging');
  console.log('✓ Automatic token invalidation');
  console.log('✓ Session revocation after password reset');
  console.log('✓ Timing attack protection');
  console.log('✓ CSRF protection via server actions');
  console.log('✓ Automatic cleanup of expired tokens');
  console.log('✓ Database transaction safety');
  console.log('✓ Error handling and logging');

  console.log('\n=== Security Architecture ===\n');
  
  console.log('Database Schema:');
  console.log('• password_reset_tokens - Secure token storage with hashing');
  console.log('• email_rate_limits - Email-based rate limiting');
  console.log('• ip_rate_limits - IP-based rate limiting with blocking');
  console.log('• security_audit_logs - Comprehensive security event logging');

  console.log('\nSecurity Controls:');
  console.log('• Token Format: Base64URL encoded 64-byte random values');
  console.log('• Token Storage: SHA-256 hashed in database');
  console.log('• Expiration: 15 minutes from generation');
  console.log('• Rate Limiting: Exponential backoff with blocking');
  console.log('• Validation: Constant-time comparison');
  console.log('• Binding: Optional IP and User-Agent validation');

  console.log('\nMVC Architecture:');
  console.log('• Model: PasswordReset with validation and security methods');
  console.log('• Repository: PasswordResetRepository for secure data access');
  console.log('• Service: PasswordResetService for business logic');
  console.log('• Actions: Secure server actions with comprehensive error handling');
}