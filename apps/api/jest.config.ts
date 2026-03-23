import type { Config } from 'jest';

const config: Config = {
  displayName: '@govmunicipio/api',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^@govmunicipio/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@govmunicipio/shared/(.*)$': '<rootDir>/../../../packages/shared/src/$1',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/main.ts',
    '!**/database/migrations/**',
    '!**/database/seeds/**',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  testTimeout: 10000,
};

export default config;
