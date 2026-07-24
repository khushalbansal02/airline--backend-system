module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.js'],
  testMatch: ['**/test/**/*.test.js'],
  // Unit tests mock all I/O, so they run without a DB or broker.
  clearMocks: true,
};
