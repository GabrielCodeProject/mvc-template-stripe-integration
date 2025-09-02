import { server } from './mocks/server';

export default async function globalTeardown() {
  console.log('🧹 Cleaning up global test environment...');
  
  // Stop the MSW server
  server.close();
  
  console.log('✅ MSW server stopped');
  
  // Additional global cleanup can go here
  // For example, cleaning up test database, clearing temp files, etc.
  
  console.log('🏁 Global test teardown complete');
}