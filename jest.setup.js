// Jest setup file for global test configuration

// Mock environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';

// Mock Redis if not available
if (!process.env.UPSTASH_REDIS_REST_URL) {
  console.log('[Jest] Running tests without Redis cache');
}

// Mock Sentry in tests
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  init: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  browserTracingIntegration: jest.fn(() => ({})),
  replayIntegration: jest.fn(() => ({})),
  httpIntegration: jest.fn(() => ({})),
  postgresIntegration: jest.fn(() => ({})),
}));

// Global test timeout
jest.setTimeout(10000);
