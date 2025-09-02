const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Base configuration for all projects
const baseConfig = {
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/playwright-tests/',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
  ],
  setupFiles: ['<rootDir>/src/test/env.setup.ts'],
  globalSetup: '<rootDir>/src/test/globalSetup.ts',
  globalTeardown: '<rootDir>/src/test/globalTeardown.ts',
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};

// Multi-project configuration
/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      ...baseConfig,
      displayName: 'ui',
      testMatch: [
        '<rootDir>/src/components/**/__tests__/**/*.{js,jsx,ts,tsx}',
        '<rootDir>/src/components/**/*.{test,spec}.{js,jsx,ts,tsx}',
      ],
      collectCoverageFrom: [
        'src/components/**/*.{js,jsx,ts,tsx}',
        '!src/components/**/*.d.ts',
        '!src/components/**/__tests__/**',
      ],
    },
    {
      ...baseConfig,
      displayName: 'services',
      testMatch: [
        '<rootDir>/src/services/**/__tests__/**/*.{js,ts}',
        '<rootDir>/src/services/**/*.{test,spec}.{js,ts}',
      ],
      collectCoverageFrom: [
        'src/services/**/*.{js,ts}',
        '!src/services/**/*.d.ts',
        '!src/services/**/__tests__/**',
      ],
      testEnvironment: 'node',
    },
    {
      ...baseConfig,
      displayName: 'actions',
      testMatch: [
        '<rootDir>/src/actions/**/__tests__/**/*.{js,ts}',
        '<rootDir>/src/actions/**/*.{test,spec}.{js,ts}',
      ],
      collectCoverageFrom: [
        'src/actions/**/*.{js,ts}',
        '!src/actions/**/*.d.ts',
        '!src/actions/**/__tests__/**',
      ],
      testEnvironment: 'node',
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testMatch: [
        '<rootDir>/src/__tests__/integration/**/*.{js,jsx,ts,tsx}',
      ],
      collectCoverageFrom: [
        'src/components/**/*.{js,jsx,ts,tsx}',
        'src/services/**/*.{js,ts}',
        'src/actions/**/*.{js,ts}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
      ],
    },
    {
      ...baseConfig,
      displayName: 'security',
      testMatch: [
        '<rootDir>/src/__tests__/security/**/*.{js,ts}',
      ],
      collectCoverageFrom: [
        'src/services/**/*.{js,ts}',
        'src/actions/**/*.{js,ts}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
      ],
      testEnvironment: 'node',
    },
    {
      ...baseConfig,
      displayName: 'accessibility',
      testMatch: [
        '<rootDir>/src/__tests__/accessibility/**/*.{js,jsx,ts,tsx}',
      ],
      collectCoverageFrom: [
        'src/components/**/*.{js,jsx,ts,tsx}',
        '!src/components/**/*.d.ts',
        '!src/components/**/__tests__/**',
      ],
    },
  ],
  // Global coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/__tests__/**',
    '!src/app/api/**',
    '!src/lib/auth.ts',
    '!src/lib/prisma.ts',
    '!src/middleware.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  verbose: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config);