module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'models/**/*.js',
    '!**/*.test.js',
    '!**/*.spec.js',
  ],
  verbose: true,
};
