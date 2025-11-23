import type { Config } from 'jest'
import nextJest from 'next/jest.js'
 
const createJestConfig = nextJest({
  dir: './',
})
 
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',

  testPathIgnorePatterns: [
    '/node_modules/',
    '/playwright_tests/',
  ],
  
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // Import paths using Next.js @/ syntax
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Note: Your source is in /src
  },
}
 
export default createJestConfig(config)