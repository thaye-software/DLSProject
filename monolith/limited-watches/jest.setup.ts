import '@testing-library/jest-dom';

// Simple UUID mock for tests
declare global {
  var crypto: Crypto;
}

if (typeof global.crypto === 'undefined') {
  (global as any).crypto = {};
}

if (typeof global.crypto.randomUUID === 'undefined') {
  global.crypto.randomUUID = () => {
    return `test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}