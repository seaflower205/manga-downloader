// Content Script for Manga Downloader Premium

(async function () {
  let pageChapterImages = [];
  const BRIDGE_ID = '__manga_dl_bridge__';
  const Security = window.MangaSecurity;
  const MAX_DOM_SNAPSHOT_CHARS = 250000;
  let matchedSite = null;
  let matchedKey = null;
  let panel = null;
  const ALLOWED_DOWNLOAD_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const ALLOWED_THEMES = new Set(['dark', 'light', 'grayscale']);
  const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
  const MAX_FETCH_IMAGE_BYTES = Math.floor(Security.DEFAULT_LIMITS.dataUrl * 0.75);

  function safeDownloadFormat(value) {
    const normalized = Security.toSafeString(value, 20).toLowerCase();
    return ALLOWED_DOWNLOAD_FORMATS.has(normalized) ? normalized : 'jpg';
  }

  function safeTheme(value) {
    const normalized = Security.toSafeString(value, 20).toLowerCase();
    return ALLOWED_THEMES.has(normalized) ? normalized : 'dark';
  }

  function isAllowedImageContentType(value) {
    const type = Security.toSafeString(value, 80).toLowerCase().split(';')[0].trim();
    return !type || ALLOWED_IMAGE_CONTENT_TYPES.has(type);
  }

  function assertSafeImageResponse(response, blob) {
    const lengthHeader = response && response.headers ? response.headers.get('content-length') : '';
    const contentLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : 0;
    if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_IMAGE_BYTES) {
      throw new Error('Image response is too large');
    }

    const contentType = response && response.headers ? response.headers.get('content-type') : '';
    if (!isAllowedImageContentType(contentType)) {
      throw new Error('Unsupported image content type');
    }

    if (blob) {
      if (blob.size > MAX_FETCH_IMAGE_BYTES) {
        throw new Error('Image blob is too large');
      }
      if (blob.type && !isAllowedImageContentType(blob.type)) {
        throw new Error('Unsupported image blob type');
      }
    }
  }

  function getCurrentHost() {
    return Security.toSafeString(window.location.hostname, 253).toLowerCase();
  }

  function logContentError(feature, error, metadata = {}) {
    Security.logDiagnostic({
      feature,
      sourceKey: matchedKey || '',
      url: window.location.href,
      error,
      metadata
    }).catch(() => {});
  }

  function normalizeImageCandidates(values, options = {}) {
    return Security.normalizeUrlArray(values, {
      baseUrl: window.location.href,
      allowBlob: Boolean(options.allowBlob),
      max: options.max || Security.DEFAULT_LIMITS.imageUrls
    });
  }

  // Security: Escape HTML to prevent XSS when inserting into innerHTML
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Security: Validate regex pattern to prevent ReDoS attacks
  function safeRegexTest(pattern, input) {
    const ok = Security.safeRegexTest(pattern, input);
    if (!ok && pattern) console.warn('Manga Downloader: Rejected unsafe or non-matching regex pattern:', pattern);
    return ok;
  }

  // Read data from the DOM bridge element (written by grabber.js in MAIN world)
  function readBridge() {
    const bridge = document.getElementById(BRIDGE_ID);
    if (bridge && bridge.textContent) {
      try {
        const data = JSON.parse(bridge.textContent);
        const normalized = normalizeImageCandidates(data, { max: 500 });
        if (normalized.length > 0 && normalized.length !== pageChapterImages.length) {
          pageChapterImages = normalized;
          console.log(`Manga Downloader: Intercepted ${pageChapterImages.length} images from page context via DOM bridge.`);
        }
      } catch (e) {
        console.warn('Manga Downloader: Failed to parse bridge data', e);
        logContentError('dom_bridge_parse', e);
      }
    }
    updateButtonState();
  }

  function getBestCaptureRoot() {
    const candidates = [];
    if (matchedSite && matchedSite.imageSelector) {
      try {
        const firstImage = document.querySelector(matchedSite.imageSelector);
        if (firstImage) {
          candidates.push(firstImage.closest('main, article, .reader, .viewer, .chapter, .chapter-content, .manga-reader, body') || firstImage.parentElement);
        }
      } catch (error) {
        logContentError('dom_capture_selector', error);
      }
    }

    document.querySelectorAll('main, article, .reader, .viewer, .chapter, .chapter-content, .manga-reader, #reader, #viewer, body').forEach(el => {
      if (el) candidates.push(el);
    });

    let best = document.body;
    let bestScore = -1;
    candidates.forEach(el => {
      if (!el) return;
      const imgCount = el.querySelectorAll ? el.querySelectorAll('img').length : 0;
      const textScore = Math.min((el.textContent || '').length, 1000) / 1000;
      const score = imgCount * 10 + textScore;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });
    return best || document.body;
  }

  function sanitizeDomClone(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('script, style, iframe, object, embed, form, input, textarea, select, button, noscript, link, meta').forEach(el => el.remove());

    clone.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'style') {
          el.removeAttribute(attr.name);
          return;
        }
        if (['src', 'href', 'data-src', 'data-original', 'data-lazy-src', 'srcset'].includes(name)) {
          if (name === 'srcset') {
            el.removeAttribute(attr.name);
            return;
          }
          const sanitized = Security.sanitizeUrlForReport(attr.value);
          if (sanitized) {
            el.setAttribute(attr.name, sanitized);
          } else {
            el.removeAttribute(attr.name);
          }
          return;
        }
        if (attr.value.length > 240) {
          el.setAttribute(attr.name, Security.redactSecrets(attr.value).slice(0, 240));
        }
      });
    });

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      node.nodeValue = Security.redactSecrets(node.nodeValue).slice(0, 500);
    });

    return clone;
  }

  function captureSanitizedDomSnapshot() {
    const root = getBestCaptureRoot();
    const clone = sanitizeDomClone(root);
    const html = clone.outerHTML.slice(0, MAX_DOM_SNAPSHOT_CHARS);
    return {
      capturedAt: new Date().toISOString(),
      pageTitle: Security.toSafeString(document.title, 200),
      url: Security.sanitizeUrlForReport(window.location.href),
      hostname: window.location.hostname,
      path: window.location.pathname.slice(0, 300),
      sourceKey: matchedKey || '',
      sourceName: matchedSite ? Security.toSafeString(matchedSite.name, 120) : '',
      rootTag: root.tagName ? root.tagName.toLowerCase() : '',
      imageCount: root.querySelectorAll ? root.querySelectorAll('img').length : 0,
      truncated: clone.outerHTML.length > MAX_DOM_SNAPSHOT_CHARS,
      html
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'CAPTURE_SANITIZED_DOM') {
      try {
        sendResponse({ success: true, snapshot: captureSanitizedDomSnapshot() });
      } catch (error) {
        logContentError('capture_sanitized_dom', error);
        sendResponse({ success: false, error: Security.sanitizeError(error).message });
      }
      return false;
    }
    return false;
  });

  // Update UI button dynamically when images are found
  function updateButtonState() {
    const mainBtn = document.querySelector('.manga-dl-btn');
    if (!mainBtn) return;
    
    // If already in active state with default styling, avoid repetitive updates
    if (mainBtn.innerHTML.includes('Tải truyện tranh') && !mainBtn.style.background) {
      return;
    }
    
    const images = getImages();
    const totalPages = isMangaPlazaSpeedreader() ? getMangaPlazaTotalPages() : 0;
    const hasContent = pageChapterImages.length > 0 || images.length > 0 || totalPages > 0;
    
    if (hasContent) {
      mainBtn.style.background = ''; // reset to default CSS style
      mainBtn.style.color = '';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải truyện tranh</span>';
    }
  }

  // Watch for the bridge element to appear or change (MutationObserver)
  const observer = new MutationObserver(() => readBridge());
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // Also poll periodically for reliability (some sites have dynamic loading)
  let bridgeChecks = 0;
  const bridgeInterval = setInterval(() => {
    readBridge();
    if (++bridgeChecks > 40 || pageChapterImages.length > 0) {
      clearInterval(bridgeInterval);
      observer.disconnect(); // Stop observing once data is found or timeout
    }
  }, 300);

  // Load site configurations and saved download format
  let savedFormat = 'jpg';
  let currentTheme = 'dark';
  const stored = await chrome.storage.local.get(['sites', 'downloadFormat', 'theme']);
  const siteResult = Security.sanitizeSiteMap(stored.sites || {});
  if (siteResult.skipped.length > 0) {
    logContentError('stored_site_validation', 'Skipped invalid stored site profiles', {
      skipped: siteResult.skipped.join(',')
    });
  }
  const storedSites = siteResult.sites;
  if (Object.keys(storedSites).length === 0) return;
  savedFormat = safeDownloadFormat(stored.downloadFormat);
  currentTheme = safeTheme(stored.theme);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.theme) {
      currentTheme = safeTheme(changes.theme.newValue);
      if (panel) {
        panel.classList.remove('light-theme', 'grayscale-theme');
        if (currentTheme !== 'dark') {
          panel.classList.add(`${currentTheme}-theme`);
        }
      }
    }
    if (areaName === 'local' && changes.downloadFormat) {
      savedFormat = safeDownloadFormat(changes.downloadFormat.newValue);
      const customSelect = document.getElementById('manga-dl-custom-select');
      if (customSelect) {
        const triggerText = customSelect.querySelector('.manga-dl-select-trigger-text');
        if (triggerText) {
          triggerText.textContent = savedFormat.toUpperCase();
        }
        const optionElements = customSelect.querySelectorAll('.manga-dl-select-option');
        optionElements.forEach(opt => {
          if (opt.getAttribute('data-value') === savedFormat) {
            opt.classList.add('selected');
          } else {
            opt.classList.remove('selected');
          }
        });
      }
    }
  });

  const currentHost = getCurrentHost();

  for (const [key, site] of Object.entries(storedSites)) {
    if (safeRegexTest(site.domainPattern, currentHost)) {
      matchedSite = site;
      matchedKey = key;
      break;
    }
  }

  if (!matchedSite) {
    console.log('Manga Downloader: Current site is not configured.');
    return;
  }

  console.log(`Manga Downloader: Matched site config [${matchedSite.name}]`);

  // Dynamic page initializers for special sites
  async function initializeSpecialSites() {
    const url = window.location.href;
    if (url.includes('mangadex.org')) {
      try {
        const match = window.location.pathname.match(/\/chapter\/([a-f0-9-]+)/);
        const chapterId = match ? match[1] : null;
        if (chapterId) {
          console.log("Manga Downloader: Querying MangaDex API for chapter:", chapterId);
          const res = await fetch('https://api.mangadex.org/at-home/server/' + chapterId);
          const json = await res.json();
          const baseUrl = json.baseUrl;
          const hash = json.chapter.hash;
          const filenames = json.chapter.data;
          pageChapterImages = normalizeImageCandidates(filenames.map(fn => `${baseUrl}/data/${hash}/${fn}`), { max: 500 });
          console.log(`Manga Downloader: Loaded ${pageChapterImages.length} images from MangaDex API.`);
          updateButtonState();
        }
      } catch (e) {
        console.warn("Manga Downloader: Failed to load MangaDex API images:", e);
        logContentError('mangadex_api_images', e);
      }
    }
  }
  initializeSpecialSites();

  // Inject styles for the premium UI
  const style = document.createElement('style');
  style.textContent = `
    .manga-dl-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: 'Outfit', 'Noto Sans JP', sans-serif;
      user-select: none;
    }
    .manga-dl-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 22px;
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      backdrop-filter: blur(8px);
    }
    .manga-dl-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 12px 40px rgba(37, 99, 235, 0.55);
      filter: brightness(1.1);
    }
    .manga-dl-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .manga-dl-icon {
      display: flex;
      align-items: center;
    }
    .manga-dl-panel {
      position: absolute;
      bottom: 74px;
      right: 0;
      width: 340px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.93) 0%, rgba(8, 8, 12, 0.98) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 22px;
      padding: 22px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), 0 0 35px rgba(37, 99, 235, 0.18);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      color: #ffffff;
      transform: translateY(15px) scale(0.96);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .manga-dl-panel.active {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    .manga-dl-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
      color: #ffffff;
      line-height: 1.3;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      padding-right: 24px;
    }
    .manga-dl-subtitle {
      font-size: 11px;
      color: #60A5FA;
      font-weight: 600;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .manga-dl-info {
      font-size: 12.5px;
      background: rgba(255, 255, 255, 0.03);
      padding: 14px 16px;
      border-radius: 14px;
      margin-bottom: 18px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .manga-dl-info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      gap: 16px;
    }
    .manga-dl-info-row:last-child {
      margin-bottom: 0;
    }
    .manga-dl-info-label {
      color: #94A3B8;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .manga-dl-info-value {
      font-weight: 600;
      color: #f1f5f9;
      font-size: 12.5px;
      text-align: right;
      word-break: break-word;
    }
    .manga-dl-start-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #3B82F6, #1D4ED8);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }
    .manga-dl-start-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(37, 99, 235, 0.45);
      filter: brightness(1.1);
    }
    .manga-dl-progress-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 12px;
    }
    .manga-dl-progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #3B82F6, #F97316);
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
      transition: width 0.3s ease;
    }
    .manga-dl-status-text {
      font-size: 12px;
      color: #60A5FA;
      font-weight: 600;
      text-align: center;
      margin-top: 8px;
    }
    .manga-dl-format-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      gap: 16px;
    }
    .manga-dl-format-label {
      color: #94A3B8;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .manga-dl-custom-select {
      position: relative;
      display: inline-block;
      width: 130px;
      user-select: none;
    }
    .manga-dl-select-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 14px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      white-space: nowrap;
      overflow: hidden;
    }
    .manga-dl-select-trigger-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .manga-dl-select-trigger:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .manga-dl-custom-select.open .manga-dl-select-trigger {
      background: rgba(255, 255, 255, 0.1);
      border-color: #3B82F6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
    }
    .manga-dl-select-arrow {
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      margin-left: 6px;
      color: #94A3B8;
      flex-shrink: 0;
    }
    .manga-dl-custom-select.open .manga-dl-select-arrow {
      transform: rotate(180deg);
      color: #3B82F6;
    }
    .manga-dl-select-options {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(8px) scale(0.97);
      width: 260px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(8, 8, 12, 0.99) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.45), 0 0 20px rgba(37, 99, 235, 0.12);
      z-index: 100000 !important;
      overflow: hidden;
      overflow-y: auto;
      max-height: 320px;
      opacity: 0;
      visibility: hidden;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
    }
    .manga-dl-custom-select.open .manga-dl-select-options {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0) scale(1);
    }
    .manga-dl-select-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }
    .manga-dl-select-option:last-child {
      border-bottom: none;
    }
    .manga-dl-select-option:hover {
      background: rgba(255, 255, 255, 0.04);
      padding-left: 17px;
    }
    .manga-dl-select-option.selected {
      background: rgba(59, 130, 246, 0.08);
      border-left: 3px solid #3B82F6;
    }
    .manga-dl-option-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.04);
      color: #94A3B8;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .manga-dl-select-option:hover .manga-dl-option-icon-wrap {
      background: rgba(59, 130, 246, 0.15);
      color: #3B82F6;
      transform: scale(1.05);
    }
    .manga-dl-select-option.selected .manga-dl-option-icon-wrap {
      background: rgba(59, 130, 246, 0.15);
      color: #3B82F6;
    }
    .manga-dl-option-text {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-width: 0;
    }
    .manga-dl-option-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .manga-dl-option-desc {
      font-size: 10px;
      color: #64748B;
      margin-top: 2px;
      font-weight: 500;
    }
    .manga-dl-select-option:hover .manga-dl-option-desc {
      color: #94A3B8;
    }
    .manga-dl-option-badge {
      font-size: 8.5px;
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .manga-dl-option-badge.badge-recom {
      background: rgba(59, 130, 246, 0.15);
      color: #60A5FA;
    }
    .manga-dl-option-badge.badge-hq {
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
    }
    .manga-dl-option-badge.badge-light {
      background: rgba(249, 115, 22, 0.15);
      color: #F97316;
    }
    .manga-dl-option-check {
      color: #3B82F6;
      display: flex;
      align-items: center;
      opacity: 0;
      transition: all 0.2s ease;
      margin-left: auto;
      flex-shrink: 0;
    }
    .manga-dl-select-option.selected .manga-dl-option-check {
      opacity: 1;
    }

    .manga-dl-close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: transparent;
      border: none;
      color: #94A3B8;
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      z-index: 10;
    }
    .manga-dl-close-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      transform: scale(1.05);
    }
    .manga-dl-close-btn:active {
      transform: scale(0.95);
    }
    .manga-dl-btn .manga-dl-icon svg.spinning {
      animation: manga-dl-spin 1.2s linear infinite;
    }
    @keyframes manga-dl-spin {
      to { transform: rotate(360deg); }
    }
    .manga-dl-preview-container {
      margin-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 14px;
    }
    .manga-dl-preview-box {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .manga-dl-preview-img-container {
      width: 70px;
      height: 95px;
      border-radius: 10px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
      cursor: zoom-in;
      flex-shrink: 0;
      transition: transform 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .manga-dl-preview-img-container:hover {
      transform: scale(1.04);
      border-color: rgba(59, 130, 246, 0.4);
    }
    .manga-dl-preview-thumbnail {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* High-end Light Glassmorphism theme for panel */
    .manga-dl-panel.light-theme {
      background: linear-gradient(135deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.98) 100%);
      border: 1px solid rgba(0, 0, 0, 0.08);
      color: #0f172a;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12), 0 0 35px rgba(79, 70, 229, 0.08);
    }
    .manga-dl-panel.light-theme .manga-dl-title {
      color: #0f172a;
      text-shadow: none;
    }
    .manga-dl-panel.light-theme .manga-dl-subtitle {
      color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-info {
      background: rgba(0, 0, 0, 0.02);
      border-color: rgba(0, 0, 0, 0.04);
    }
    .manga-dl-panel.light-theme .manga-dl-info-label {
      color: #475569;
    }
    .manga-dl-panel.light-theme .manga-dl-info-value {
      color: #0f172a;
    }
    .manga-dl-panel.light-theme .manga-dl-format-label {
      color: #475569;
    }
    .manga-dl-panel.light-theme .manga-dl-select-trigger {
      background: rgba(0, 0, 0, 0.03);
      border-color: rgba(0, 0, 0, 0.08);
      color: #0f172a;
    }
    .manga-dl-panel.light-theme .manga-dl-select-trigger:hover {
      background: rgba(0, 0, 0, 0.06);
    }
    .manga-dl-panel.light-theme .manga-dl-custom-select.open .manga-dl-select-trigger {
      background: rgba(0, 0, 0, 0.06);
      border-color: #4f46e5;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
    }
    .manga-dl-panel.light-theme .manga-dl-select-arrow {
      color: #475569;
    }
    .manga-dl-panel.light-theme .manga-dl-custom-select.open .manga-dl-select-arrow {
      color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-select-options {
      background: rgba(248, 250, 252, 0.98);
      border-color: rgba(0, 0, 0, 0.08);
      box-shadow: 0 -8px 25px rgba(0, 0, 0, 0.1), 0 0 15px rgba(79, 70, 229, 0.05);
    }
    .manga-dl-panel.light-theme .manga-dl-select-option {
      border-bottom-color: rgba(0, 0, 0, 0.03);
    }
    .manga-dl-panel.light-theme .manga-dl-select-option:hover {
      background: rgba(0, 0, 0, 0.02);
    }
    .manga-dl-panel.light-theme .manga-dl-select-option.selected {
      background: rgba(79, 70, 229, 0.04);
      border-left-color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-option-title {
      color: #0f172a;
    }
    .manga-dl-panel.light-theme .manga-dl-option-desc {
      color: #64748B;
    }
    .manga-dl-panel.light-theme .manga-dl-select-option:hover .manga-dl-option-desc {
      color: #475569;
    }
    .manga-dl-panel.light-theme .manga-dl-option-icon-wrap {
      background: rgba(0, 0, 0, 0.02);
      color: #64748B;
    }
    .manga-dl-panel.light-theme .manga-dl-select-option:hover .manga-dl-option-icon-wrap {
      background: rgba(79, 70, 229, 0.1);
      color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-select-option.selected .manga-dl-option-icon-wrap {
      background: rgba(79, 70, 229, 0.1);
      color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-option-check {
      color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-close-btn {
      color: #64748b;
    }
    .manga-dl-panel.light-theme .manga-dl-close-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #0f172a;
    }
    .manga-dl-panel.light-theme .manga-dl-start-btn {
      background: linear-gradient(135deg, #4f46e5, #3b82f6);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
    }
    .manga-dl-panel.light-theme .manga-dl-start-btn:hover {
      box-shadow: 0 8px 25px rgba(79, 70, 229, 0.35);
    }
    .manga-dl-panel.light-theme .manga-dl-status-text {
      color: #4f46e5;
    }
    .manga-dl-panel.light-theme .manga-dl-preview-container {
      border-top-color: rgba(0, 0, 0, 0.06);
    }
    .manga-dl-panel.light-theme .manga-dl-preview-img-container {
      background: rgba(0, 0, 0, 0.05);
      border-color: rgba(0, 0, 0, 0.06);
    }
    .manga-dl-panel.light-theme #manga-dl-preview-size span {
      color: #4f46e5 !important;
    }
    .manga-dl-panel.light-theme #manga-dl-preview-size strong {
      color: #0f172a !important;
    }
    .manga-dl-panel.light-theme #manga-dl-preview-total-size {
      color: #4f46e5 !important;
    }

    /* Grayscale theme: simply apply grayscale filter to the panel container */
    .manga-dl-panel.grayscale-theme {
      filter: grayscale(100%) contrast(1.05);
    }
  `;
  document.head.appendChild(style);


  // Helper to fetch blob URL and convert to Data URL (Base64)
  async function fetchBlobAsDataUrl(url) {
    const safeUrl = Security.normalizeUrl(url, { baseUrl: window.location.href, allowHttp: true, allowBlob: true });
    if (!safeUrl) throw new Error('Invalid image URL');
    const res = await fetch(safeUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    assertSafeImageResponse(res);
    const blob = await res.blob();
    assertSafeImageResponse(res, blob);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  // Helper to fetch any image URL with background script fallback
  async function fetchImageAsDataUrlSafe(url) {
    if (url.startsWith('blob:')) {
      return await fetchBlobAsDataUrl(url);
    }
    try {
      return await fetchBlobAsDataUrl(url);
    } catch (e) {
      console.warn('Direct fetch failed, falling back to background for:', url, e);
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'FETCH_GROUP_DATA',
          data: {
            urls: [url],
            referer: window.location.href
          }
        }, (results) => {
          if (results && results[0] && results[0].success) {
            resolve(results[0].dataUrl);
          } else {
            reject(new Error('Failed to fetch image via background script: ' + url));
          }
        });
      });
    }
  }

  // Helper to load image from data URL
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load image: ' + e.message));
      img.src = dataUrl;
    });
  }

  // Merge group of image objects vertically using canvas
  async function mergeImageGroup(dataUrls, format = 'image/jpeg') {
    if (dataUrls.length === 0) return null;

    const images = await Promise.all(dataUrls.map(url => loadImage(url)));

    let maxWidth = 0;
    let totalHeight = 0;
    images.forEach(img => {
      if (img.naturalWidth > maxWidth) maxWidth = img.naturalWidth;
      totalHeight += img.naturalHeight;
    });

    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    // Fill white background for JPEG
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let currentY = 0;
    images.forEach(img => {
      ctx.drawImage(img, 0, currentY, maxWidth, img.naturalHeight);
      currentY += img.naturalHeight;
    });

    // Export as high quality
    let mergedDataUrl;
    if (format === 'image/jpeg') {
      mergedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    } else if (format === 'image/webp') {
      mergedDataUrl = canvas.toDataURL('image/webp', 0.92);
    } else {
      mergedDataUrl = canvas.toDataURL('image/png');
    }

    // Free memory
    images.forEach(img => {
      img.src = '';
    });

    return mergedDataUrl;
  }

  // Scrape page helper
  function getMetadata() {
    let titleEl = null;
    let chapterEl = null;
    try {
      titleEl = matchedSite.titleSelector ? document.querySelector(matchedSite.titleSelector) : null;
      chapterEl = matchedSite.chapterSelector ? document.querySelector(matchedSite.chapterSelector) : null;
    } catch (error) {
      logContentError('metadata_selector_query', error);
    }
    
    let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
    let chapter = chapterEl ? chapterEl.textContent.trim() : 'Chapter';

    // Clean title and chapter names for folder names
    title = title.replace(/[\\\\/:*?\"<>|]/g, '').trim();
    chapter = chapter.replace(/[\\\\/:*?\"<>|]/g, '').trim();

    return { title, chapter };
  }

  function getImages() {
    // If we intercepted the chapterImages from the main world, return it directly (very robust for sites like mangaball)
    if (pageChapterImages && pageChapterImages.length > 0) {
      return pageChapterImages;
    }

    const images = [];
    const seen = new Set();
    const selectors = matchedSite.imageSelector.split(',');
    const attributes = (matchedSite.imageUrlAttribute || 'src').split('|');

    selectors.forEach(sel => {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(sel.trim()));
      } catch (error) {
        logContentError('image_selector_query', error, { selector: sel.trim() });
      }

      nodes.forEach(img => {
        let src = '';
        for (const attr of attributes) {
          const val = img.getAttribute(attr.trim());
          const safeVal = Security.normalizeUrl(val, { baseUrl: window.location.href, allowHttp: true, allowProtocolRelative: true });
          if (safeVal) {
            src = safeVal;
            break;
          }
        }
        
        // Fallback to standard src
        if (!src && img.src) {
          src = Security.normalizeUrl(img.src, { baseUrl: window.location.href, allowHttp: true });
        }

        // ⚡ Bolt: Use O(1) Set lookup instead of O(N) Array.includes() for performance
        if (src && !seen.has(src)) {
          seen.add(src);
          images.push(src);
        }
      });
    });

    return images;
  }

  // Create UI elements
  const container = document.createElement('div');
  container.className = 'manga-dl-container';

  panel = document.createElement('div');
  panel.className = 'manga-dl-panel';
  if (currentTheme && currentTheme !== 'dark') {
    panel.classList.add(`${currentTheme}-theme`);
  }

  const mainBtn = document.createElement('button');
  mainBtn.className = 'manga-dl-btn';
  mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải truyện tranh</span>';

  container.appendChild(panel);
  container.appendChild(mainBtn);
  document.body.appendChild(container);

  function isChapterPage() {
    if (!matchedSite) return false;
    if (!matchedSite.chapterUrlPattern) return true;
    return safeRegexTest(matchedSite.chapterUrlPattern, window.location.href);
  }

  // Helper: detect MangaPlaza total pages from the page counter
  function getMangaPlazaTotalPages() {
    const captionEl = document.querySelector('#menu_cnt_left') || document.querySelector('#menu_slidercaption');
    if (captionEl) {
      const match = captionEl.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
      if (match) return parseInt(match[2], 10);
    }
    return 0;
  }

  // Helper: check if current site is MangaPlaza speedreader
  function isMangaPlazaSpeedreader() {
    return window.location.hostname.includes('mangaplaza') && window.location.href.includes('speedreader');
  }

  function getPageNum() {
    const el = document.querySelector('#menu_slidercaption') || document.querySelector('#menu_cnt_left');
    if (!el) return null;
    const match = el.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Set button to error state
  function setButtonError() {
    mainBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> <span>Lỗi cấu trúc trang</span>';
  }

  // Set button to "not a chapter page" state
  function setButtonNotChapter() {
    mainBtn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> <span>Mở chương để tải</span>';
  }

  // Set button to loading/waiting state
  function setButtonLoading() {
    mainBtn.style.background = 'linear-gradient(135deg, #3B82F6, #8B5CF6)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg class="spinning" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg></span> <span>Đang tải trang...</span>';
  }

  // Set initial state of main button based on images count
  readBridge(); // Check if grabber.js already wrote data
  const initialImages = getImages();
  if (initialImages.length === 0) {
    if (isMangaPlazaSpeedreader()) {
      // MangaPlaza speedreader loads asynchronously — show loading state and retry
      setButtonLoading();
      let retryCount = 0;
      const maxRetries = 30; // 30 x 500ms = 15 seconds
      const retryInterval = setInterval(() => {
        const mpPages = getMangaPlazaTotalPages();
        const imgs = getImages();
        if (mpPages > 0 || imgs.length > 0) {
          clearInterval(retryInterval);
          updateButtonState();
          console.log(`Manga Downloader: MangaPlaza speedreader detected ${mpPages} pages after ${retryCount} retries.`);
        } else if (++retryCount >= maxRetries) {
          clearInterval(retryInterval);
          setButtonError();
          console.warn('Manga Downloader: MangaPlaza speedreader content not found after retries.');
        }
      }, 500);
    } else if (isChapterPage()) {
      setButtonError();
    } else {
      setButtonNotChapter();
    }
  }

  // Toggle panel visibility
  mainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close panel if already open
    if (panel.classList.contains('active')) {
      panel.classList.remove('active');
      return;
    }
    
    // Refresh page data on open
    const { title, chapter } = getMetadata();
    const images = getImages();

    // Refresh button state dynamically in case images loaded later
    let totalPages = isMangaPlazaSpeedreader() ? getMangaPlazaTotalPages() : 0;

    const hasContent = images.length > 0 || totalPages > 0;
    if (!hasContent) {
      if (isMangaPlazaSpeedreader()) {
        setButtonLoading();
      } else if (isChapterPage()) {
        setButtonError();
      } else {
        setButtonNotChapter();
      }
    } else {
      mainBtn.style.background = '';
      mainBtn.style.color = '';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải truyện tranh</span>';
    }

    // Determine target size description and action button HTML
    let targetDesc = `${images.length} ảnh gốc`;
    if (totalPages > 0) {
      targetDesc = `${totalPages} trang (đọc từ MangaPlaza Speedreader)`;
    } else if (images.length > 30) {
      const groupSize = Math.ceil(images.length / 20);
      const finalCount = Math.ceil(images.length / groupSize);
      targetDesc = `${images.length} ảnh gốc (sẽ gộp thành ~${finalCount} trang dài)`;
    }

    let actionBtnHtml = `<button class="manga-dl-start-btn" id="manga-dl-action-btn">Tải Chapter Này</button>`;

    if (!hasContent) {
      if (isChapterPage()) {
        actionBtnHtml = `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.4; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div><strong>Cấu trúc trang web đã thay đổi!</strong> Không tìm thấy hình ảnh nào bằng bộ lọc hiện tại. Vui lòng kiểm tra hoặc cập nhật lại cấu hình selectors.</div>
          </div>
        `;
      } else {
        actionBtnHtml = `
          <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.25); color: #93c5fd; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.4; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div><strong>Chưa mở trang đọc truyện!</strong> Vui lòng bấm chọn một chương truyện để có thể tải ảnh về.</div>
          </div>
        `;
      }
    }

    panel.innerHTML = `
      <button class="manga-dl-close-btn" id="manga-dl-close-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="manga-dl-title">${escapeHtml(title)}</div>
      <div class="manga-dl-subtitle">${escapeHtml(chapter)}</div>
      <div class="manga-dl-info">
        <div class="manga-dl-info-row">
          <span class="manga-dl-info-label">Nguồn:</span>
          <span class="manga-dl-info-value">${escapeHtml(matchedSite.name)}</span>
        </div>
        <div class="manga-dl-info-row">
          <span class="manga-dl-info-label">Số trang:</span>
          <span class="manga-dl-info-value">${targetDesc}</span>
        </div>
        ${hasContent ? `
        <div class="manga-dl-format-row">
          <span class="manga-dl-format-label">Định dạng tải:</span>
          <div class="manga-dl-custom-select" id="manga-dl-custom-select">
            <div class="manga-dl-select-trigger" id="manga-dl-select-trigger">
              <span class="manga-dl-select-trigger-text">
                ${savedFormat.toUpperCase()}
              </span>
              <svg class="manga-dl-select-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="manga-dl-select-options" id="manga-dl-select-options">
              <div class="manga-dl-select-option ${savedFormat === 'jpg' ? 'selected' : ''}" data-value="jpg">
                <div class="manga-dl-option-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div class="manga-dl-option-text">
                  <div class="manga-dl-option-title">JPG <span class="manga-dl-option-badge badge-recom">Đề xuất</span></div>
                  <div class="manga-dl-option-desc">Tương thích tốt, dung lượng vừa phải.</div>
                </div>
                <div class="manga-dl-option-check">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <div class="manga-dl-select-option ${savedFormat === 'jpeg' ? 'selected' : ''}" data-value="jpeg">
                <div class="manga-dl-option-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div class="manga-dl-option-text">
                  <div class="manga-dl-option-title">JPEG</div>
                  <div class="manga-dl-option-desc">Định dạng ảnh truyền thống phổ biến.</div>
                </div>
                <div class="manga-dl-option-check">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <div class="manga-dl-select-option ${savedFormat === 'png' ? 'selected' : ''}" data-value="png">
                <div class="manga-dl-option-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
                </div>
                <div class="manga-dl-option-text">
                  <div class="manga-dl-option-title">PNG <span class="manga-dl-option-badge badge-hq">HQ</span></div>
                  <div class="manga-dl-option-desc">Không nén, giữ nguyên chi tiết sắc nét.</div>
                </div>
                <div class="manga-dl-option-check">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <div class="manga-dl-select-option ${savedFormat === 'webp' ? 'selected' : ''}" data-value="webp">
                <div class="manga-dl-option-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <div class="manga-dl-option-text">
                  <div class="manga-dl-option-title">WEBP <span class="manga-dl-option-badge badge-light">Tối ưu</span></div>
                  <div class="manga-dl-option-desc">Nén hiện đại, dung lượng siêu nhẹ.</div>
                </div>
                <div class="manga-dl-option-check">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
      <div class="manga-dl-preview-container" id="manga-dl-preview-container" style="display: none;">
        <div class="manga-dl-preview-box">
          <div class="manga-dl-preview-img-container" id="manga-dl-preview-img-container">
            <img class="manga-dl-preview-thumbnail" id="manga-dl-preview-thumbnail" src="" alt="Preview">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(8,8,12,0.7); color: #fff; font-size: 8px; font-weight: bold; text-align: center; padding: 2px 0;">XEM ẢNH</div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 11px; color: #94A3B8; font-weight: 500; margin-bottom: 2px;">Trang 1:</div>
            <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px;" id="manga-dl-preview-size">Đang tính...</div>
            <div style="font-size: 11px; color: #60A5FA; font-weight: 600;" id="manga-dl-preview-total-size">Ước tính cả chương: ...</div>
          </div>
        </div>
      </div>
      ${actionBtnHtml}
      <div id="manga-dl-progress-container" style="display: none;">
        <div class="manga-dl-progress-bar">
          <div class="manga-dl-progress-fill" id="manga-dl-progress-fill"></div>
        </div>
        <div class="manga-dl-status-text" id="manga-dl-status-text">Đang tải: 0%</div>
      </div>
    `;

    // Helper functions for Preview inside panel context
    const getSampleImage = async () => {
      if (window.location.hostname.includes('mangaplaza')) {
        const pageNum = getPageNum();
        let ptImg = pageNum ? document.querySelector(`#content-p${pageNum} .pt-img`) : null;
        if (!ptImg || ptImg.querySelectorAll('img').length === 0) {
          ptImg = document.querySelector('.pt-img');
        }
        if (ptImg && ptImg.querySelectorAll('img').length > 0) {
          const imgSlices = Array.from(ptImg.querySelectorAll('img')).map(img => {
            const div = img.parentElement;
            const style = div.style.cssText || div.getAttribute('style') || '';
            const insetMatch = style.match(/inset:\s*([\d.-]+)%/);
            let topPercent = 0;
            if (insetMatch) topPercent = parseFloat(insetMatch[1]);
            else {
              const topMatch = style.match(/top:\s*([\d.-]+)%/);
              if (topMatch) topPercent = parseFloat(topMatch[1]);
            }
            return { src: img.src, topPercent };
          });
          imgSlices.sort((a, b) => a.topPercent - b.topPercent);
          const sliceUrls = imgSlices.map(s => s.src);
          const dataUrls = [];
          for (const u of sliceUrls) {
            const du = await fetchBlobAsDataUrl(u);
            dataUrls.push(du);
          }
          return { type: 'merged', urls: dataUrls };
        }
        return null;
      } else {
        const imgs = getImages();
        if (imgs.length > 0) {
          return { type: 'single', url: imgs[0] };
        }
        return null;
      }
    };

    const previewContainer = panel.querySelector('#manga-dl-preview-container');
    const previewImg = panel.querySelector('#manga-dl-preview-thumbnail');
    const previewSizeText = panel.querySelector('#manga-dl-preview-size');
    const previewTotalSizeText = panel.querySelector('#manga-dl-preview-total-size');
    const previewImgContainer = panel.querySelector('#manga-dl-preview-img-container');

    let previewDataUrl = '';

    const updatePreview = async () => {
      if (!previewContainer) return;
      const selectedFormat = savedFormat;

      let mimeFormat = 'image/jpeg';
      if (selectedFormat === 'webp') mimeFormat = 'image/webp';
      else if (selectedFormat === 'png') mimeFormat = 'image/png';

      previewContainer.style.display = 'block';
      if (previewSizeText) previewSizeText.textContent = 'Đang tính toán...';
      if (previewTotalSizeText) previewTotalSizeText.textContent = 'Đang tải ảnh mẫu...';

      try {
        const sample = await getSampleImage();
        if (!sample) {
          previewContainer.style.display = 'none';
          return;
        }

        let mergedUrl = '';
        if (sample.type === 'merged') {
          mergedUrl = await mergeImageGroup(sample.urls, mimeFormat);
        } else {
          const dataUrl = await fetchImageAsDataUrlSafe(sample.url);
          mergedUrl = await mergeImageGroup([dataUrl], mimeFormat);
        }

        if (mergedUrl) {
          previewDataUrl = mergedUrl;
          if (previewImg) previewImg.src = mergedUrl;
          
          const base64Str = mergedUrl.split(',')[1];
          const bytes = Math.floor(base64Str.length * 0.75);
          
          let sizeStr = '';
          if (bytes > 1024 * 1024) sizeStr = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
          else sizeStr = `${(bytes / 1024).toFixed(1)} KB`;
          
          if (previewSizeText) {
            previewSizeText.innerHTML = `<span style="color: #60A5FA;">${selectedFormat.toUpperCase()}</span>: <strong>${sizeStr}</strong>`;
          }

          const totalPages = isMangaPlazaSpeedreader() ? getMangaPlazaTotalPages() : getImages().length;
          const totalBytes = bytes * totalPages;
          let totalSizeStr = '';
          if (totalBytes > 1024 * 1024) totalSizeStr = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
          else totalSizeStr = `${(totalBytes / 1024).toFixed(0)} KB`;

          if (previewTotalSizeText) {
            previewTotalSizeText.textContent = `Ước tính cả chương (${totalPages} trang): ~${totalSizeStr}`;
          }
        }
      } catch (err) {
        console.error('Manga Downloader: Preview failed', err);
        if (previewSizeText) previewSizeText.textContent = 'Lỗi tải ảnh mẫu';
        if (previewTotalSizeText) previewTotalSizeText.textContent = 'Vui lòng thử lại';
      }
    };

    function showLightbox(src) {
      let lightbox = document.getElementById('manga-dl-lightbox');
      if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'manga-dl-lightbox';
        lightbox.style.cssText = `
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(8, 8, 12, 0.96);
          z-index: 1000000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          cursor: zoom-out;
        `;
        const img = document.createElement('img');
        img.id = 'manga-dl-lightbox-img';
        img.style.cssText = `
          max-width: 92%;
          max-height: 92%;
          object-fit: contain;
          border-radius: 14px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(255,255,255,0.1);
          transition: transform 0.3s ease;
        `;
        lightbox.appendChild(img);
        document.body.appendChild(lightbox);
        
        lightbox.addEventListener('click', () => {
          lightbox.style.opacity = '0';
          lightbox.style.pointerEvents = 'none';
        });
      }
      
      const img = lightbox.querySelector('#manga-dl-lightbox-img');
      if (img) img.src = src;
      
      lightbox.style.opacity = '1';
      lightbox.style.pointerEvents = 'auto';
    }

    if (previewImgContainer) {
      previewImgContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (previewDataUrl) {
          showLightbox(previewDataUrl);
        }
      });
    }

    // Close button listener
    const closeBtn = panel.querySelector('#manga-dl-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('active');
      });
    }

    // Custom select dropdown logic
    const customSelect = panel.querySelector('#manga-dl-custom-select');
    if (customSelect) {
      const selectTrigger = customSelect.querySelector('#manga-dl-select-trigger');
      const optionElements = customSelect.querySelectorAll('.manga-dl-select-option');

      if (selectTrigger) {
        selectTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          customSelect.classList.toggle('open');
        });
      }

      optionElements.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = safeDownloadFormat(option.getAttribute('data-value'));
          savedFormat = value;

          // Update selected style
          optionElements.forEach(opt => opt.classList.remove('selected'));
          option.classList.add('selected');

          // Update trigger text
          const triggerText = selectTrigger.querySelector('.manga-dl-select-trigger-text');
          if (triggerText) {
            triggerText.textContent = value.toUpperCase();
          }

          // Save selection to storage
          chrome.storage.local.set({ downloadFormat: savedFormat });
          
          // Trigger preview recalculation
          updatePreview();

          // Close dropdown
          customSelect.classList.remove('open');
        });
      });
    }




    panel.classList.toggle('active');

    if (panel.classList.contains('active')) {
      updatePreview();
    }

    // Action listener inside panel
    const actionBtn = panel.querySelector('#manga-dl-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', async () => {
        const selectedFormat = savedFormat;

        let mimeFormat = 'image/jpeg';
        if (selectedFormat === 'webp') {
          mimeFormat = 'image/webp';
        } else if (selectedFormat === 'png') {
          mimeFormat = 'image/png';
        }

        const getMimeType = (dataUrl) => {
          const match = dataUrl.match(/^data:([^;]+);/);
          return match ? match[1] : '';
        };

        actionBtn.style.display = 'none';
        const progressContainer = panel.querySelector('#manga-dl-progress-container');
        const progressFill = panel.querySelector('#manga-dl-progress-fill');
        const statusText = panel.querySelector('#manga-dl-status-text');

        progressContainer.style.display = 'block';

        const processedImages = [];
        let successGroups = 0;
        let totalGroups = 0;

        if (window.location.hostname.includes('mangaplaza')) {
          // Special MangaPlaza Speedreader handler
          
          // Dismiss tutorial modal if present
          const tipsFrame = document.getElementById('menu_tips_frame');
          if (tipsFrame) {
            try {
              const doc = tipsFrame.contentDocument || tipsFrame.contentWindow.document;
              if (doc) {
                const closeBtn = doc.getElementById('img_button');
                if (closeBtn) {
                  console.log("Manga Downloader: Dismissing MangaPlaza tutorial modal.");
                  closeBtn.click();
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            } catch (e) {
              console.warn("Manga Downloader: Failed to dismiss tutorial modal", e);
            }
          }

          // Wait for MangaPlaza page counter to appear (up to 10s)
          let totalPages = getMangaPlazaTotalPages();
          if (totalPages === 0) {
            statusText.textContent = 'Đang chờ MangaPlaza tải xong...';
            for (let wait = 0; wait < 20 && totalPages === 0; wait++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              totalPages = getMangaPlazaTotalPages();
            }
          }
          if (totalPages === 0) {
            statusText.style.color = '#ef4444';
            statusText.textContent = `Lỗi! Không lấy được số trang MangaPlaza. Hãy đợi trang tải xong rồi thử lại.`;
            actionBtn.style.display = 'block';
            return;
          }

          totalGroups = totalPages;
          statusText.textContent = `Đang di chuyển về trang 1...`;
          progressFill.style.width = '5%';

          // Navigate back to page 1 using robust navigation
          const getPageNum = () => {
            const el = document.querySelector('#menu_slidercaption') || document.querySelector('#menu_cnt_left');
            if (!el) return null;
            const match = el.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
            return match ? parseInt(match[1], 10) : null;
          };

          let pageNum = getPageNum();
          let prevRetries = 0;
          while (pageNum !== null && pageNum > 1 && prevRetries < 100) {
            const prevPage = pageNum;
            document.dispatchEvent(new CustomEvent('manga-dl-navigate', { detail: { direction: 'prev' } }));
            
            let changed = false;
            for (let w = 0; w < 15; w++) {
              await new Promise(resolve => setTimeout(resolve, 30));
              pageNum = getPageNum();
              if (pageNum !== null && pageNum < prevPage) {
                changed = true;
                break;
              }
            }
            if (!changed) {
              break;
            }
            prevRetries++;
          }

          // Single-loop to collect, download slices and merge immediately for each page
          for (let p = 1; p <= totalPages; p++) {
            statusText.style.color = '#3B82F6';
            statusText.textContent = `Đang tải & xử lý trang ${p}/${totalPages}...`;
            progressFill.style.width = `${Math.round((p / totalPages) * 90) + 5}%`;

            // Wait for #content-p{p} .pt-img to be loaded and have images
            let ptImg = null;
            let waitRetries = 0;
            while (waitRetries < 30) {
              const container = document.querySelector(`#content-p${p}`);
              if (container) {
                ptImg = container.querySelector('.pt-img');
                if (ptImg && ptImg.querySelectorAll('img').length > 0) {
                  break;
                }
              }
              await new Promise(resolve => setTimeout(resolve, 100));
              waitRetries++;
            }

            if (!ptImg) {
              console.warn(`Manga Downloader: Failed to load pt-img for page ${p}`);
              logContentError('mangaplaza_page_slice_missing', 'Failed to load page slices', { page: p });
            } else {
              const imgSlices = Array.from(ptImg.querySelectorAll('img')).map(img => {
                const div = img.parentElement;
                const style = div.style.cssText || div.getAttribute('style') || '';
                const insetMatch = style.match(/inset:\s*([\d.-]+)%/);
                let topPercent = 0;
                if (insetMatch) {
                  topPercent = parseFloat(insetMatch[1]);
                } else {
                  const topMatch = style.match(/top:\s*([\d.-]+)%/);
                  if (topMatch) {
                    topPercent = parseFloat(topMatch[1]);
                  }
                }
                return { src: img.src, topPercent };
              });
              
              // Sort by topPercent
              imgSlices.sort((a, b) => a.topPercent - b.topPercent);
              const sliceUrls = imgSlices.map(s => s.src);

              try {
                // Fetch slices as data URLs in content script context immediately
                const sliceDataUrls = [];
                for (const sliceUrl of sliceUrls) {
                  const dataUrl = await fetchBlobAsDataUrl(sliceUrl);
                  sliceDataUrls.push(dataUrl);
                }

                // Merge slices vertically
                const mergedDataUrl = await mergeImageGroup(sliceDataUrls, mimeFormat);
                if (mergedDataUrl) {
                  processedImages.push({
                    filename: `${String(p).padStart(3, '0')}.${selectedFormat}`,
                    dataUrl: mergedDataUrl
                  });
                  successGroups++;
                }
              } catch (err) {
                console.error(`Error processing MangaPlaza page ${p}:`, err);
                logContentError('mangaplaza_process_page', err, { page: p });
              }
            }

            // Move to next page and wait for the page number to increment
            if (p < totalPages) {
              const prevPage = p;
              document.dispatchEvent(new CustomEvent('manga-dl-navigate', { detail: { direction: 'next' } }));
              
              let changed = false;
              for (let w = 0; w < 20; w++) {
                await new Promise(resolve => setTimeout(resolve, 50));
                const currentPage = getPageNum();
                if (currentPage !== null && currentPage > prevPage) {
                  changed = true;
                  break;
                }
              }
              if (!changed) {
                console.warn(`Manga Downloader: Page navigation timed out at page ${p}`);
              }
            }
          }

        } else {
          // Standard download handler (including MangaDex)
          const needMerging = images.length > 30 && !window.location.hostname.includes('mangadex.org');
          const targetCount = 20;
          const groupSize = needMerging ? Math.ceil(images.length / targetCount) : 1;
          totalGroups = Math.ceil(images.length / groupSize);

          for (let i = 0; i < images.length; i += groupSize) {
            const groupIndex = Math.floor(i / groupSize);
            const groupUrls = images.slice(i, i + groupSize);

            statusText.style.color = '#a855f7';
            statusText.textContent = `Đang tải & xử lý nhóm ${groupIndex + 1}/${totalGroups}...`;
            progressFill.style.width = `${Math.round((groupIndex / totalGroups) * 90) + 5}%`;

            try {
              const fetchedResults = await Promise.all(groupUrls.map(async (url) => {
                if (url.startsWith('blob:')) {
                  try {
                    const dataUrl = await fetchBlobAsDataUrl(url);
                    return { success: true, dataUrl };
                  } catch (e) {
                    console.error('Failed to fetch blob URL:', url, e);
                    logContentError('fetch_blob_image', e);
                    return { success: false };
                  }
                } else {
                  // Try direct fetch in content script first (bypasses CORS/Referer issues on many CDNs)
                  try {
                    const dataUrl = await fetchBlobAsDataUrl(url);
                    return { success: true, dataUrl };
                  } catch (e) {
                    console.warn('Direct fetch in content script failed, falling back to background:', url, e);
                    logContentError('fetch_image_direct_fallback', e);
                    // Fallback to background script
                    return new Promise((resolve) => {
                      chrome.runtime.sendMessage({
                        type: 'FETCH_GROUP_DATA',
                        data: {
                          urls: [url],
                          referer: window.location.href
                        }
                      }, (results) => {
                        if (results && results[0] && results[0].success) {
                          resolve({ success: true, dataUrl: results[0].dataUrl });
                        } else {
                          resolve({ success: false });
                        }
                      });
                    });
                  }
                }
              }));

              const successfulDataUrls = fetchedResults.filter(r => r.success).map(r => r.dataUrl);

              if (successfulDataUrls.length > 0) {
                let finalDataUrl;
                let extension = selectedFormat;
                if (needMerging) {
                  finalDataUrl = await mergeImageGroup(successfulDataUrls, mimeFormat);
                } else {
                  const originalDataUrl = successfulDataUrls[0];
                  const originalMime = getMimeType(originalDataUrl);

                  if (originalMime === mimeFormat) {
                    finalDataUrl = originalDataUrl;
                  } else {
                    finalDataUrl = await mergeImageGroup(successfulDataUrls, mimeFormat);
                  }
                }

                if (finalDataUrl) {
                  const paddedIndex = String(groupIndex + 1).padStart(3, '0');
                  processedImages.push({
                    filename: `${paddedIndex}.${extension}`,
                    dataUrl: finalDataUrl
                  });
                  successGroups++;
                }
              }
            } catch (err) {
              console.error(`Error processing group ${groupIndex + 1}:`, err);
              logContentError('process_image_group', err, { group: groupIndex + 1 });
            }
          }
        }

      if (processedImages.length === 0) {
        statusText.style.color = '#ef4444';
        statusText.textContent = `Lỗi! Không tải được ảnh nào.`;
        logContentError('download_no_images', 'No processed images were created.', { imageCount: images.length });
        actionBtn.style.display = 'block';
        return;
      }

      // Send to background to compress into ZIP
      statusText.textContent = `Đang đóng gói file ZIP...`;
      progressFill.style.width = '95%';

      chrome.runtime.sendMessage({
        type: 'SAVE_ZIP_DOWNLOAD',
        data: {
          images: processedImages,
          title,
          chapter
        }
      }, (response) => {
        if (response && response.success) {
          progressFill.style.width = '100%';
          statusText.style.color = '#10b981';
          statusText.textContent = `Thành công! Đã lưu file ZIP (${successGroups}/${totalGroups} trang).`;
          setTimeout(() => {
            panel.classList.remove('active');
          }, 3500);
        } else {
          statusText.style.color = '#ef4444';
          statusText.textContent = `Lỗi đóng gói: ${response ? response.error : 'Không rõ nguyên nhân'}`;
          logContentError('save_zip_response', response ? response.error : 'Unknown ZIP error', { imageCount: processedImages.length });
          actionBtn.style.display = 'block';
        }
      });
    });
  }
});



})();
