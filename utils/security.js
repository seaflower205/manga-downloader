(function (root) {
  'use strict';

  const DIAGNOSTIC_KEY = 'diagnosticEvents';
  const MAX_DIAGNOSTIC_EVENTS = 120;
  const MAX_DIAGNOSTIC_BYTES = 250000;
  const DIAGNOSTIC_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

  const DEFAULT_LIMITS = {
    string: 500,
    url: 2000,
    selector: 350,
    regex: 140,
    siteName: 120,
    siteKey: 64,
    searchResults: 50,
    imageUrls: 500,
    zipImages: 350,
    dataUrl: 80000000,
    totalZipDataUrl: 350000000
  };

  function toSafeString(value, maxLength = DEFAULT_LIMITS.string) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .trim()
      .slice(0, maxLength);
  }

  function redactSecrets(value) {
    return toSafeString(value, 8000)
      .replace(/([?&](?:token|auth|key|api_key|sig|signature|expires|hash|csrf|session|cookie|jwt|access_token|refresh_token)=)[^&#\s"'<>]+/gi, '$1[redacted]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
      .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[phone]')
      .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[opaque-id]');
  }

  function normalizeUrl(value, options = {}) {
    const {
      baseUrl,
      allowHttp = true,
      allowBlob = false,
      allowProtocolRelative = true,
      stripQuery = false
    } = options;

    const raw = toSafeString(value, DEFAULT_LIMITS.url);
    if (!raw) return '';

    try {
      let input = raw;
      if (allowProtocolRelative && raw.startsWith('//')) {
        const baseProtocol = baseUrl ? new URL(baseUrl).protocol : 'https:';
        input = baseProtocol + raw;
      }

      const parsed = new URL(input, baseUrl || undefined);
      const allowed =
        (allowHttp && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) ||
        (allowBlob && parsed.protocol === 'blob:');

      if (!allowed) return '';
      if (stripQuery && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
        parsed.search = '';
        parsed.hash = '';
      }
      return parsed.href;
    } catch (error) {
      return '';
    }
  }

  function sanitizeUrlForReport(value) {
    const normalized = normalizeUrl(value, { allowBlob: true, stripQuery: true });
    if (!normalized) return '';
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === 'blob:') return 'blob:[redacted]';
      return redactSecrets(parsed.origin + parsed.pathname).slice(0, DEFAULT_LIMITS.url);
    } catch (error) {
      return '';
    }
  }

  function isSafeRegexPattern(pattern) {
    const value = toSafeString(pattern, DEFAULT_LIMITS.regex);
    if (!value || value.length > DEFAULT_LIMITS.regex) return false;
    if (!/^[a-zA-Z0-9.\\\[\]\-_|^$/]+$/.test(value)) return false;
    if (value.includes('.*') || value.includes('(?') || /\\[1-9]/.test(value)) return false;
    try {
      new RegExp(value, 'i');
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeRegexTest(pattern, input) {
    if (!isSafeRegexPattern(pattern)) return false;
    try {
      return new RegExp(pattern, 'i').test(toSafeString(input, DEFAULT_LIMITS.url));
    } catch (error) {
      return false;
    }
  }

  function validateSelectorString(selector, required = false) {
    const value = toSafeString(selector, DEFAULT_LIMITS.selector);
    if (!value) return { valid: !required, value, error: required ? 'Selector is required.' : '' };
    if (/[<>`]/.test(value)) return { valid: false, value: '', error: 'Selector contains unsafe characters.' };
    if (typeof document !== 'undefined') {
      try {
        document.querySelector(value);
      } catch (error) {
        return { valid: false, value: '', error: 'Selector is invalid.' };
      }
    }
    return { valid: true, value, error: '' };
  }

  function slugKey(value) {
    return toSafeString(value, DEFAULT_LIMITS.siteKey)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, DEFAULT_LIMITS.siteKey);
  }

  function validateSiteProfile(key, rawSite) {
    const errors = [];
    if (!rawSite || typeof rawSite !== 'object' || Array.isArray(rawSite)) {
      return { valid: false, errors: ['Site profile must be an object.'] };
    }

    const safeKey = slugKey(key || rawSite.name);
    if (!safeKey) errors.push('Invalid site key.');

    const name = toSafeString(rawSite.name, DEFAULT_LIMITS.siteName);
    if (!name) errors.push('Site name is required.');

    const domainPattern = toSafeString(rawSite.domainPattern, DEFAULT_LIMITS.regex);
    if (!isSafeRegexPattern(domainPattern)) errors.push('Domain pattern is unsafe or invalid.');

    const chapterUrlPattern = toSafeString(rawSite.chapterUrlPattern || '', DEFAULT_LIMITS.regex);
    if (chapterUrlPattern && !isSafeRegexPattern(chapterUrlPattern)) {
      errors.push('Chapter URL pattern is unsafe or invalid.');
    }

    const imageSelector = validateSelectorString(rawSite.imageSelector, true);
    if (!imageSelector.valid) errors.push(imageSelector.error);

    const titleSelector = validateSelectorString(rawSite.titleSelector || '', false);
    if (!titleSelector.valid) errors.push('Title selector is invalid.');

    const chapterSelector = validateSelectorString(rawSite.chapterSelector || '', false);
    if (!chapterSelector.valid) errors.push('Chapter selector is invalid.');

    const imageUrlAttribute = toSafeString(rawSite.imageUrlAttribute || 'src', 120)
      .split('|')
      .map(attr => attr.trim())
      .filter(attr => /^[a-zA-Z0-9:_-]{1,40}$/.test(attr))
      .join('|') || 'src';

    let nextPageSelectorValue = '';
    if (rawSite.nextPageSelector) {
      const rawVal = toSafeString(rawSite.nextPageSelector, DEFAULT_LIMITS.selector);
      if (rawVal.startsWith('key:')) {
        nextPageSelectorValue = rawVal;
        if (!/^key:[a-zA-Z0-9_-]+$/.test(rawVal)) {
          errors.push('Next page selector key simulation format is invalid.');
        }
      } else {
        const valSel = validateSelectorString(rawVal, false);
        if (!valSel.valid) {
          errors.push('Next page selector is invalid.');
        } else {
          nextPageSelectorValue = valSel.value;
        }
      }
    }

    const refererRaw = toSafeString(rawSite.referer || '', DEFAULT_LIMITS.url);
    const referer = refererRaw ? normalizeUrl(refererRaw, { allowHttp: true }) : '';
    if (refererRaw && !referer) errors.push('Referer must be a valid http(s) URL.');

    const isNsfw = Boolean(rawSite.isNsfw);
    const searchSupported = Boolean(rawSite.searchSupported) || Boolean(rawSite.searchUrl && rawSite.searchResultSelector);

    const searchUrlRaw = toSafeString(rawSite.searchUrl || '', DEFAULT_LIMITS.url);
    const searchUrl = searchUrlRaw ? normalizeUrl(searchUrlRaw.replace(/\{.*?\}/g, 'test'), { allowHttp: true }) : '';
    if (searchUrlRaw && !searchUrl) errors.push('Search URL must be a valid http(s) URL.');

    const searchResultSelector = validateSelectorString(rawSite.searchResultSelector || '', false);
    if (!searchResultSelector.valid) errors.push('Search result selector is invalid.');

    const searchTitleSelector = validateSelectorString(rawSite.searchTitleSelector || '', false);
    if (!searchTitleSelector.valid) errors.push('Search title selector is invalid.');

    const searchCoverSelector = validateSelectorString(rawSite.searchCoverSelector || '', false);
    if (!searchCoverSelector.valid) errors.push('Search cover selector is invalid.');

    const searchAuthorSelector = validateSelectorString(rawSite.searchAuthorSelector || '', false);
    if (!searchAuthorSelector.valid) errors.push('Search author selector is invalid.');

    const searchResponseFormat = toSafeString(rawSite.searchResponseFormat || 'html', 20);
    const searchResultPath = toSafeString(rawSite.searchResultPath || '', 100);
    const searchTitlePath = toSafeString(rawSite.searchTitlePath || '', 100);
    const searchCoverPath = toSafeString(rawSite.searchCoverPath || '', 100);
    const searchUrlPath = toSafeString(rawSite.searchUrlPath || '', 100);
    const searchAuthorPath = toSafeString(rawSite.searchAuthorPath || '', 100);

    const imagesResponseFormat = toSafeString(rawSite.imagesResponseFormat || 'html', 20);
    const imagesResultPath = toSafeString(rawSite.imagesResultPath || '', 100);
    const imagesJsonVariable = toSafeString(rawSite.imagesJsonVariable || '', 100);

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      key: safeKey,
      site: {
        name,
        domainPattern,
        chapterUrlPattern,
        imageSelector: imageSelector.value,
        imageUrlAttribute,
        nextPageSelector: nextPageSelectorValue,
        titleSelector: titleSelector.value,
        chapterSelector: chapterSelector.value,
        referer,
        isNsfw,
        searchSupported,
        searchUrl: searchUrlRaw ? searchUrlRaw : '',
        searchResultSelector: searchResultSelector.value,
        searchTitleSelector: searchTitleSelector.value,
        searchCoverSelector: searchCoverSelector.value,
        searchAuthorSelector: searchAuthorSelector.value,
        searchResponseFormat,
        searchResultPath,
        searchTitlePath,
        searchCoverPath,
        searchUrlPath,
        searchAuthorPath,
        imagesResponseFormat,
        imagesResultPath,
        imagesJsonVariable
      },
      errors: []
    };
  }

  function sanitizeSiteMap(rawSites) {
    const sites = {};
    const skipped = [];
    if (!rawSites || typeof rawSites !== 'object' || Array.isArray(rawSites)) {
      return { sites, skipped: ['sites'] };
    }

    Object.entries(rawSites).forEach(([key, site]) => {
      const result = validateSiteProfile(key, site);
      if (result.valid) {
        let finalKey = result.key;
        let suffix = 2;
        while (sites[finalKey]) {
          finalKey = `${result.key}_${suffix++}`;
        }
        sites[finalKey] = result.site;
      } else {
        skipped.push(key);
      }
    });

    return { sites, skipped };
  }

  function normalizeUrlArray(values, options = {}) {
    if (!Array.isArray(values)) return [];
    const max = Math.min(options.max || DEFAULT_LIMITS.imageUrls, DEFAULT_LIMITS.imageUrls);
    const seen = new Set();
    const output = [];

    for (const value of values) {
      if (output.length >= max) break;
      if (typeof value !== 'string') continue;
      const normalized = normalizeUrl(value, {
        baseUrl: options.baseUrl,
        allowHttp: true,
        allowBlob: Boolean(options.allowBlob),
        allowProtocolRelative: true
      });
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        output.push(normalized);
      }
    }

    return output;
  }

  function safeFilename(value, fallback = 'download', maxLength = 120) {
    const cleaned = toSafeString(value, maxLength)
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || fallback;
  }

  function isSafeZipEntryName(value) {
    return /^[0-9A-Za-z._-]{1,80}\.(?:jpg|jpeg|png|webp|gif)$/i.test(toSafeString(value, 100));
  }

  function isSafeImageDataUrl(value) {
    const dataUrl = typeof value === 'string' ? value : '';
    return dataUrl.length <= DEFAULT_LIMITS.dataUrl &&
      /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(dataUrl);
  }

  function normalizeSearchResult(item) {
    if (!item || typeof item !== 'object') return null;
    const title = toSafeString(item.title, 180);
    const source = toSafeString(item.source, 80);
    const url = normalizeUrl(item.url, { allowHttp: true });
    if (!title || !source || !url) return null;

    return {
      title,
      author: toSafeString(item.author || 'Nhieu tac gia', 160),
      thumbnail: normalizeUrl(item.thumbnail || '', { allowHttp: true }),
      url,
      source,
      sourceKey: slugKey(item.sourceKey || source)
    };
  }

  function sanitizeError(error) {
    if (!error) return { name: 'Error', message: '', stack: '' };
    if (typeof error === 'string') {
      return { name: 'Error', message: redactSecrets(error).slice(0, 300), stack: '' };
    }
    return {
      name: toSafeString(error.name || 'Error', 80),
      message: redactSecrets(error.message || String(error)).slice(0, 300),
      stack: redactSecrets(error.stack || '').slice(0, 1800)
    };
  }

  function sanitizeDiagnosticEvent(event) {
    const sourceUrl = event && (event.url || event.pageUrl || event.href);
    let hostname = '';
    let path = '';
    try {
      const parsed = sourceUrl ? new URL(normalizeUrl(sourceUrl, { allowBlob: true }) || sourceUrl) : null;
      if (parsed && parsed.protocol !== 'blob:') {
        hostname = parsed.hostname;
        path = parsed.pathname.slice(0, 300);
      }
    } catch (error) {
      // Ignore malformed diagnostic URLs.
    }

    const metadata = {};
    const rawMetadata = event && event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    Object.entries(rawMetadata).slice(0, 20).forEach(([key, value]) => {
      const safeKey = slugKey(key);
      if (!safeKey) return;
      if (typeof value === 'number' || typeof value === 'boolean') {
        metadata[safeKey] = value;
      } else {
        metadata[safeKey] = redactSecrets(value).slice(0, 240);
      }
    });

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      extensionVersion: root.chrome && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '',
      feature: toSafeString(event && event.feature, 100) || 'unknown',
      sourceKey: slugKey(event && event.sourceKey),
      hostname: toSafeString(event && event.hostname, 180) || hostname,
      path: toSafeString(event && event.path, 300) || path,
      url: sanitizeUrlForReport(sourceUrl),
      error: sanitizeError(event && (event.error || event.message)),
      httpStatus: Number.isFinite(event && event.httpStatus) ? event.httpStatus : undefined,
      imageCount: Number.isFinite(event && event.imageCount) ? event.imageCount : undefined,
      selectorCount: Number.isFinite(event && event.selectorCount) ? event.selectorCount : undefined,
      metadata,
      userAgent: typeof navigator !== 'undefined' ? toSafeString(navigator.userAgent, 300) : ''
    };
  }

  async function logDiagnostic(event) {
    if (!root.chrome || !chrome.storage || !chrome.storage.local) return null;
    const sanitized = sanitizeDiagnosticEvent(event || {});
    try {
      const data = await chrome.storage.local.get(DIAGNOSTIC_KEY);
      const cutoff = Date.now() - DIAGNOSTIC_RETENTION_MS;
      let events = Array.isArray(data[DIAGNOSTIC_KEY]) ? data[DIAGNOSTIC_KEY] : [];
      events = events.filter(item => Date.parse(item.timestamp || 0) >= cutoff);
      events.push(sanitized);
      events = events.slice(-MAX_DIAGNOSTIC_EVENTS);

      while (JSON.stringify(events).length > MAX_DIAGNOSTIC_BYTES && events.length > 1) {
        events.shift();
      }

      await chrome.storage.local.set({ [DIAGNOSTIC_KEY]: events });
      return sanitized;
    } catch (error) {
      console.warn('Manga Downloader: Failed to write diagnostics.', error);
      return null;
    }
  }

  async function getDiagnosticEvents() {
    if (!root.chrome || !chrome.storage || !chrome.storage.local) return [];
    const data = await chrome.storage.local.get(DIAGNOSTIC_KEY);
    return Array.isArray(data[DIAGNOSTIC_KEY]) ? data[DIAGNOSTIC_KEY] : [];
  }

  async function buildDiagnosticReport() {
    const events = await getDiagnosticEvents();
    return {
      generatedAt: new Date().toISOString(),
      extensionVersion: root.chrome && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '',
      eventCount: events.length,
      events
    };
  }

  async function clearDiagnostics() {
    if (!root.chrome || !chrome.storage || !chrome.storage.local) return;
    await chrome.storage.local.set({ [DIAGNOSTIC_KEY]: [] });
  }

  function isSafeGithubRepo(value) {
    return /^[A-Za-z0-9_.-]{1,80}\/[A-Za-z0-9_.-]{1,120}$/.test(toSafeString(value, 220));
  }

  root.MangaSecurity = {
    DEFAULT_LIMITS,
    toSafeString,
    redactSecrets,
    normalizeUrl,
    sanitizeUrlForReport,
    isSafeRegexPattern,
    safeRegexTest,
    validateSelectorString,
    slugKey,
    validateSiteProfile,
    sanitizeSiteMap,
    normalizeUrlArray,
    safeFilename,
    isSafeZipEntryName,
    isSafeImageDataUrl,
    normalizeSearchResult,
    sanitizeError,
    logDiagnostic,
    getDiagnosticEvents,
    buildDiagnosticReport,
    clearDiagnostics,
    isSafeGithubRepo
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
