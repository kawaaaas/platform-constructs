module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 120000,
  setupFiles: ['<rootDir>/test/setup.js'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, skipLibCheck: true } }] },
};
