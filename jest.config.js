/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'node',
  
  // Roots
  roots: ['<rootDir>/packages/', '<rootDir>/apps/'],
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  
  // Transform files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@zzik/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@zzik/database/(.*)$': '<rootDir>/packages/database/src/$1',
    '^@/(.*)$': '<rootDir>/apps/web/$1',
  },
  
  // Coverage
  collectCoverageFrom: [
    'packages/**/src/**/*.{ts,tsx}',
    'apps/**/app/**/*.{ts,tsx}',
    'apps/**/lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
  ],
  
  coverageThresholds: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/dist/',
    '/tests/e2e/',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Verbose output
  verbose: true,
  
  // Max workers
  maxWorkers: '50%',
};

module.exports = config;
