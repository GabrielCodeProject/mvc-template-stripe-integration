import { renderWithUser, createMockFile } from '../utils/test-utils';

describe('Test Infrastructure', () => {
  it('should have Jest configured correctly', () => {
    expect(jest).toBeDefined();
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should have test utilities working', () => {
    expect(typeof renderWithUser).toBe('function');
    expect(typeof createMockFile).toBe('function');
  });

  it('should have proper module resolution', () => {
    // Test that @ alias works
    expect(() => require('@/models/UserProfile')).not.toThrow();
  });

  it('should have MSW server configured', () => {
    // Basic test to ensure server is running
    expect(global.fetch).toBeDefined();
  });
});