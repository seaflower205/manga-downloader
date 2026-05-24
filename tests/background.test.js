// Mock Security before requiring the file
global.self = {};
global.importScripts = () => {};

global.self.MangaSecurity = {
  DEFAULT_LIMITS: { url: 200 },
  toSafeString: (value, limit) => {
    if (value === null || value === undefined) return '';
    return String(value).slice(0, limit);
  },
  logDiagnostic: async () => {},
  sanitizeSiteMap: (sites) => {
    return Object.keys(sites || {}).length > 0 ? sites : { defaultSite: {} };
  }
};

const fs = require('fs');
const vm = require('vm');

// Read background.js content
const scriptContent = fs.readFileSync('background/background.js', 'utf8');

// Create a sandbox context
const sandbox = {
  self: global.self,
  importScripts: global.importScripts,
  chrome: {
    declarativeNetRequest: {},
    downloads: {},
    runtime: {
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      getURL: () => 'mock-url'
    },
    storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } }
  },
  console: {
    error: () => {}, // Suppress console.error in tests
    log: () => {},
    warn: () => {}
  },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  URL: URL,
  Math: Math,
  Date: Date,
  Number: Number,
  Set: Set,
  String: String,
  Array: Array,
  Object: Object,
  encodeURIComponent: encodeURIComponent,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
};

vm.createContext(sandbox);
vm.runInContext(scriptContent, sandbox);

describe('escapeDnrRegex', () => {
  const escapeDnrRegex = sandbox.escapeDnrRegex;

  it('should escape all regex special characters', () => {
    const chars = '\\^$.*+?()[]{}|';
    const escaped = escapeDnrRegex(chars);
    // Note: JS replaces \ with \\, ^ with \^, etc.
    expect(escaped).toBe('\\\\\\^\\$\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|');
  });

  it('should not escape normal characters', () => {
    expect(escapeDnrRegex('abc123DEF')).toBe('abc123DEF');
  });

  it('should handle typical URLs', () => {
    const url = 'https://example.com/path?query=val&other=val2+3.4';
    const expected = 'https://example\\.com/path\\?query=val&other=val2\\+3\\.4';
    expect(escapeDnrRegex(url)).toBe(expected);
  });

  it('should handle empty string', () => {
    expect(escapeDnrRegex('')).toBe('');
  });

  it('should limit string length based on limit parameter', () => {
    const limit = 200; // As passed to toSafeString in escapeDnrRegex
    const longString = 'a'.repeat(limit + 10);
    expect(escapeDnrRegex(longString).length).toBe(limit);
  });

  it('should handle null and undefined', () => {
    expect(escapeDnrRegex(null)).toBe('');
    expect(escapeDnrRegex(undefined)).toBe('');
  });
});
