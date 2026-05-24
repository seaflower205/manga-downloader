// Setup global mocks for Chrome extension environment
global.importScripts = () => {};
global.self = global;
global.chrome = {
  runtime: {
    id: 'test-id',
    getURL: () => '',
    onInstalled: { addListener: () => {} },
    onMessage: { addListener: () => {} },
    sendMessage: () => Promise.resolve()
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve()
    }
  },
  declarativeNetRequest: {
    updateSessionRules: () => Promise.resolve()
  },
  downloads: {
    download: () => Promise.resolve()
  }
};
global.fetch = () => Promise.resolve({
  json: () => Promise.resolve({ sites: {} }),
  ok: true
});

// Load security utils which attaches to global.MangaSecurity
require('../utils/security.js');
const { isSafeRemoteFilename } = require('../background/background.js');

describe('isSafeRemoteFilename', () => {
  it('should accept valid UUIDs with allowed image extensions', () => {
    // Valid lengths 10 to 40 characters
    expect(isSafeRemoteFilename('abcdef1234.jpg')).toBe(true); // 10 chars
    expect(isSafeRemoteFilename('a1b2c3d4e5f6.jpeg')).toBe(true); // 12 chars
    expect(isSafeRemoteFilename('a1b2c3d4e5f6.png')).toBe(true);
    expect(isSafeRemoteFilename('a1b2c3d4e5f6.webp')).toBe(true);
    expect(isSafeRemoteFilename('a1b2c3d4e5f6.gif')).toBe(true);

    // MangaDex IDs are 36 characters typically
    expect(isSafeRemoteFilename('12345678-1234-1234-1234-123456789abc.jpg')).toBe(true); // 36 chars
    expect(isSafeRemoteFilename('12345678-1234-1234-1234-123456789abc.PNG')).toBe(true); // Case-insensitive

    // 40 chars max limit
    expect(isSafeRemoteFilename('1234567890123456789012345678901234567890.jpg')).toBe(true); // 40 chars
  });

  it('should reject filenames with lengths outside 10-40 characters', () => {
    expect(isSafeRemoteFilename('abcdef123.jpg')).toBe(false); // 9 chars
    expect(isSafeRemoteFilename('12345678901234567890123456789012345678901.jpg')).toBe(false); // 41 chars
  });

  it('should reject invalid extensions', () => {
    expect(isSafeRemoteFilename('12345678-1234-1234-1234-123456789abc.txt')).toBe(false);
    expect(isSafeRemoteFilename('12345678-1234-1234-1234-123456789abc.php')).toBe(false);
    expect(isSafeRemoteFilename('12345678-1234-1234-1234-123456789abc.')).toBe(false);
    expect(isSafeRemoteFilename('12345678-1234-1234-1234-123456789abc')).toBe(false);
  });

  it('should reject invalid characters', () => {
    expect(isSafeRemoteFilename('../1234567890.jpg')).toBe(false);
    expect(isSafeRemoteFilename('1234567890/.jpg')).toBe(false);
    expect(isSafeRemoteFilename('1234567890\\.jpg')).toBe(false);
    expect(isSafeRemoteFilename('!@#$%^&*(.jpg')).toBe(false);
    expect(isSafeRemoteFilename('this is a test.jpg')).toBe(false);
    expect(isSafeRemoteFilename('123456789g.jpg')).toBe(false); // 'g' is not hex
    expect(isSafeRemoteFilename('123456789z.jpg')).toBe(false);
  });

  it('should handle non-string or edge cases gracefully (due to Security.toSafeString)', () => {
    expect(isSafeRemoteFilename(null)).toBe(false);
    expect(isSafeRemoteFilename(undefined)).toBe(false);
    expect(isSafeRemoteFilename({})).toBe(false);
    expect(isSafeRemoteFilename(1234567890.1)).toBe(false);
  });
});
