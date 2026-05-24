const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('isAllowedImageContentType', () => {
  let isAllowedImageContentType;

  beforeAll(() => {
    const backgroundCode = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');
    const securityCode = fs.readFileSync(path.join(__dirname, '../utils/security.js'), 'utf8');

    // Setup basic mock environment for background script
    const context = vm.createContext({
      self: {},
      root: {},
      importScripts: () => {},
      chrome: {
        runtime: {
          getURL: () => '',
          onInstalled: { addListener: () => {} },
          onMessage: { addListener: () => {} }
        },
        storage: {
          local: {
            get: async () => ({}),
            set: async () => {}
          }
        }
      },
      fetch: async () => ({
        json: async () => ({ sites: {}, skipped: [] })
      }),
      console: { log: () => {}, error: () => {}, warn: () => {} },
      Math: Math,
      Date: Date,
      Number: Number,
      Set: Set,
      String: String,
      btoa: (str) => Buffer.from(str).toString('base64'),
      URL: URL,
      Uint8Array: Uint8Array,
      Promise: Promise,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout
    });

    vm.runInContext(securityCode, context);
    vm.runInContext('self.MangaSecurity = root.MangaSecurity || MangaSecurity;', context);
    vm.runInContext(backgroundCode, context);

    // Get the function from the context
    isAllowedImageContentType = context.isAllowedImageContentType;
  });

  it('should return true for allowed content types', () => {
    expect(isAllowedImageContentType('image/jpeg')).toBe(true);
    expect(isAllowedImageContentType('image/png')).toBe(true);
    expect(isAllowedImageContentType('image/webp')).toBe(true);
    expect(isAllowedImageContentType('image/gif')).toBe(true);
    expect(isAllowedImageContentType('image/jpg')).toBe(true);
  });

  it('should handle case insensitivity', () => {
    expect(isAllowedImageContentType('IMAGE/JPEG')).toBe(true);
    expect(isAllowedImageContentType('image/PNG')).toBe(true);
  });

  it('should handle content types with parameters', () => {
    expect(isAllowedImageContentType('image/jpeg; charset=utf-8')).toBe(true);
    expect(isAllowedImageContentType('image/png; boundary=something')).toBe(true);
  });

  it('should return true for empty or null values', () => {
    expect(isAllowedImageContentType('')).toBe(true);
    expect(isAllowedImageContentType(null)).toBe(true);
    expect(isAllowedImageContentType(undefined)).toBe(true);
  });

  it('should handle extra whitespace', () => {
    expect(isAllowedImageContentType(' image/jpeg ')).toBe(true);
  });

  it('should return false for disallowed content types', () => {
    expect(isAllowedImageContentType('text/html')).toBe(false);
    expect(isAllowedImageContentType('application/json')).toBe(false);
    expect(isAllowedImageContentType('image/svg+xml')).toBe(false);
    expect(isAllowedImageContentType('application/javascript')).toBe(false);
  });

  it('should handle malicious inputs', () => {
    expect(isAllowedImageContentType('image/jpeg\u0000')).toBe(true);
    expect(isAllowedImageContentType('image/jpeg\n')).toBe(true);
  });
});
