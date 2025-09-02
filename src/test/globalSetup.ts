import { server } from './mocks/server';

export default async function globalSetup() {
  console.log('🧪 Setting up global test environment...');
  
  // Start the MSW server
  server.listen({
    onUnhandledRequest: 'error',
  });

  console.log('✅ MSW server started');
  
  // Additional global setup can go here
  // For example, setting up test database, clearing caches, etc.
  
  console.log('🎯 Global test setup complete');
}