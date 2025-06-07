module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  moduleNameMapper: {
    // If you use module aliases, configure them here
    // Example: '^@components/(.*)$': '<rootDir>/src/components/$1',
    // For this project, paths are relative from src, so need to adjust.
    // Or, if jest runs from 'gita' dir, then '<rootDir>/src/...' is fine.
    // Assuming jest runs from 'gita' directory as root.
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1', // Added for api mocks if needed
    '^@types/(.*)$': '<rootDir>/src/types/$1', // Added for types if needed
    // Mock CSS/asset imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  // Indicates the root directory Jest should scan for tests and modules within
  // By default, it's the directory of the jest.config.js file.
  // If your tests are in `gita/src/tests` or `gita/src/__tests__`, this default is fine.
  // If tests are alongside files (e.g. `gita/src/utils/markdownUtils.test.ts`), also fine.
};
