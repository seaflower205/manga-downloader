const fs = require('fs');
const vm = require('vm');

const contentCode = fs.readFileSync('content/content.js', 'utf8');

const sandbox = {
  window: {
    location: { hostname: 'example.com', href: 'https://example.com' },
    MangaSecurity: {
      DEFAULT_LIMITS: { dataUrl: 1000, imageUrls: 100 },
      toSafeString: (s) => s,
      sanitizeUrlForReport: (u) => u,
      normalizeUrlArray: (a) => a,
      safeRegexTest: () => false,
      sanitizeSiteMap: () => ({ skipped: [], sites: {} }),
      logDiagnostic: async () => {},
    }
  },
  document: {
    documentElement: {},
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    createElement: () => ({
      appendChild: () => {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
      querySelector: () => ({ textContent: '', appendChild: () => {} })
    }),
    createTextNode: () => ({}),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  },
  chrome: {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => {}
    },
    storage: {
      local: { get: async () => ({ sites: {} }), set: async () => {} },
      onChanged: { addListener: () => {} }
    }
  },
  MutationObserver: class { observe() {} disconnect() {} },
  setInterval: () => {},
  clearInterval: () => {},
  console: console,
  Math: Math,
  Date: Date,
  Promise: Promise,
  Set: Set,
  fetch: async () => ({ json: async () => ({}) })
};

const context = vm.createContext(sandbox);

try {
  vm.runInContext(contentCode, context);
  console.log('Script loaded successfully without throwing!');
} catch (e) {
  console.error('Failed to load script:', e);
  process.exit(1);
}
