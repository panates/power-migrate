module.exports = {
  testEnvironment: 'node',
  verbose: true,
  maxWorkers: '50%',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+.ts?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/tsconfig.json',
        // isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    '(\\..+)\\.js': '$1',
    'power-migrate': '<rootDir>/src',
  },
  // globalSetup: '<rootDir>/test/_support/global_setup.ts',
  modulePathIgnorePatterns: ['<rootDir>/build'],
  reporters: ['default'],
  coverageReporters: ['lcov'],
  coveragePathIgnorePatterns: ['/build/', '/node_modules/', 'support'],
  coverageDirectory: '<rootDir>/coverage/',
};
