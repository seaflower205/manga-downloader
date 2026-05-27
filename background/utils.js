// Background Utility and Helper Functions
(function (root) {
  'use strict';

  const Security = root.MangaSecurity || {};
  let nextDnrRuleId = Math.floor(Date.now() % 1000000) + 2000;
  const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/octet-stream',
    'binary/octet-stream'
  ]);
  const MAX_FETCH_IMAGE_BYTES = Math.floor((Security.DEFAULT_LIMITS?.dataUrl || 80000000) * 0.75);

  // Search state cache to survive popup closing
  root.currentSearchState = {
    query: '',
    searchId: '',
    nsfwSearchId: '',
    results: [],
    blockedSites: {}, // siteKey -> { sourceName, url, isNsfw }
    finishedDefault: false,
    finishedNsfw: false,
    activeSites: {},
    nsfwActive: false,
    targetSites: null,
    timestamp: 0
  };

  root.activeVerificationTabs = new Map(); // tabId -> { siteKey, query, searchId, intervalId, timeoutId }

  function isAllowedImageContentType(value) {
    const type = String(value || '').toLowerCase().split(';')[0].trim();
    return !type || ALLOWED_IMAGE_CONTENT_TYPES.has(type);
  }

  function assertSafeImageResponse(response, buffer) {
    const lengthHeader = response && response.headers ? response.headers.get('content-length') : '';
    const contentLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : 0;
    if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_IMAGE_BYTES) {
      throw new Error('Image response is too large');
    }

    const contentType = response && response.headers ? response.headers.get('content-type') : '';
    if (!isAllowedImageContentType(contentType)) {
      throw new Error('Unsupported image content type');
    }

    if (buffer && typeof buffer.byteLength === 'number' && buffer.byteLength > MAX_FETCH_IMAGE_BYTES) {
      throw new Error('Image buffer is too large');
    }
  }

  function escapeDnrRegex(value) {
    return String(value || '').replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  }

  function getNextDnrRuleId() {
    nextDnrRuleId += 1;
    if (nextDnrRuleId > 1000000000) nextDnrRuleId = 2001;
    return nextDnrRuleId;
  }

  function logBackgroundError(feature, error, metadata = {}) {
    if (Security.logDiagnostic) {
      Security.logDiagnostic({ feature, error, metadata }).catch(() => {});
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function extractActualYahooUrl(url) {
    if (!url) return '';
    try {
      const ruMatch = url.match(/\/RU=([^/]+)/);
      if (ruMatch) {
        return decodeURIComponent(ruMatch[1]);
      }
    } catch (e) {}
    return url;
  }

  function isSafeMangaDexId(value) {
    const safeStr = Security.toSafeString ? Security.toSafeString(value, 80) : String(value || '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeStr);
  }

  function isSafeRemoteFilename(value) {
    const safeStr = Security.toSafeString ? Security.toSafeString(value, 200) : String(value || '');
    return /^[0-9A-Za-z._-]{1,180}$/.test(safeStr);
  }

  function normalizeSearchResults(results) {
    if (!Array.isArray(results)) return [];
    return results
      .map(item => {
        if (Security.normalizeSearchResult) {
          return Security.normalizeSearchResult(item);
        }
        return item;
      })
      .filter(Boolean);
  }

  function normalizeTrustedHttpUrl(value, allowedHosts, baseUrl = '') {
    if (!value) return '';
    try {
      const resolved = baseUrl ? new URL(value, baseUrl).href : new URL(value).href;
      const parsed = new URL(resolved);
      const host = parsed.hostname;
      
      const trusted = allowedHosts.some(allowed => {
        if (allowed.startsWith('.')) {
          return host.endsWith(allowed) || host === allowed.substring(1);
        }
        return host === allowed || host.endsWith('.' + allowed);
      });
      return trusted ? parsed.href : '';
    } catch (error) {
      return '';
    }
  }

  // Export functions to global scope (self/this)
  root.BgUtils = {
    isAllowedImageContentType,
    assertSafeImageResponse,
    escapeDnrRegex,
    getNextDnrRuleId,
    logBackgroundError,
    arrayBufferToBase64,
    extractActualYahooUrl,
    isSafeMangaDexId,
    isSafeRemoteFilename,
    normalizeSearchResults,
    normalizeTrustedHttpUrl
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
