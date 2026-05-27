// Content Script Downloader and Converter Module
(function (root) {
  'use strict';

  const Security = root.MangaSecurity || {};
  const MAX_FETCH_IMAGE_BYTES = Math.floor((Security.DEFAULT_LIMITS?.dataUrl || 80000000) * 0.75);
  const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/octet-stream',
    'binary/octet-stream'
  ]);

  function getSharedState() {
    if (!root.MangaSharedState) {
      root.MangaSharedState = {
        pageChapterImages: [],
        matchedSite: null,
        matchedKey: null,
        canvasCache: {},
        isScrolling: false,
        hasAutoScrolled: false
      };
    }
    return root.MangaSharedState;
  }

  function isAllowedImageContentType(value) {
    const type = String(value || '').toLowerCase().split(';')[0].trim();
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

  async function fetchBlobAsDataUrl(url) {
    if (url && url.startsWith('data:')) return url;
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

  async function fetchImageAsDataUrlSafe(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      const du = await fetchBlobAsDataUrl(url);
      return du;
    } catch (err) {
      console.warn('Content script direct fetch failed, trying background fallback:', url, err);
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
            const errorDetails = results && results[0] ? results[0].error : 'Unknown background error';
            reject(new Error(`Background fetch failed: ${errorDetails}`));
          }
        });
      });
    }
  }

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

    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let currentY = 0;
    images.forEach(img => {
      ctx.drawImage(img, 0, currentY, maxWidth, img.naturalHeight);
      currentY += img.naturalHeight;
    });

    let mergedDataUrl;
    if (format === 'image/jpeg') {
      mergedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    } else if (format === 'image/webp') {
      mergedDataUrl = canvas.toDataURL('image/webp', 0.92);
    } else {
      mergedDataUrl = canvas.toDataURL('image/png');
    }

    images.forEach(img => {
      img.src = '';
    });

    return mergedDataUrl;
  }

  function isCanvasBlank(canvas) {
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
  }

  function captureVisibleCanvases() {
    const state = getSharedState();
    if (!state.matchedSite || !state.matchedSite.imageSelector.includes('canvas')) return;
    
    document.querySelectorAll(state.matchedSite.imageSelector).forEach(canvas => {
      if (canvas.tagName && canvas.tagName.toLowerCase() === 'canvas') {
        const pageIndex = getCanvasPageIndex(canvas);
        if (pageIndex !== -1 && !state.canvasCache[pageIndex]) {
          try {
            if (canvas.width > 100 && canvas.height > 100 && !isCanvasBlank(canvas)) {
              const canvasData = canvas.toDataURL('image/jpeg', 0.85);
              if (canvasData && canvasData.startsWith('data:')) {
                state.canvasCache[pageIndex] = canvasData;
              }
            }
          } catch (e) {
            console.warn('Manga Downloader: Unreadable canvas in captureVisibleCanvases:', e);
          }
        }
      }
    });
  }

  function getCanvasPageIndex(canvas) {
    let parent = canvas.parentElement;
    let depth = 0;
    while (parent && depth < 4) {
      const id = parent.id || '';
      const className = parent.className || '';
      const text = parent.textContent || '';
      
      const idMatch = id.match(/page[_-]?(\d+)/i) || id.match(/p(\d+)/i);
      if (idMatch) return parseInt(idMatch[1], 10);
      
      const classMatch = className.match(/page[_-]?(\d+)/i) || className.match(/p(\d+)/i);
      if (classMatch) return parseInt(classMatch[1], 10);
      
      const textMatch = text.match(/page[_-]?(\d+)/i);
      if (textMatch) return parseInt(textMatch[1], 10);
      
      parent = parent.parentElement;
      depth++;
    }
    
    const sliderCaption = document.querySelector('#menu_slidercaption') || document.querySelector('#menu_cnt_left');
    if (sliderCaption) {
      const match = sliderCaption.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    
    return -1;
  }

  async function autoScrollPage() {
    const state = getSharedState();
    if (state.isScrolling) return;
    state.isScrolling = true;
    state.hasAutoScrolled = true;
    
    const originalScrollY = window.scrollY;
    const totalHeight = document.documentElement.scrollHeight;
    
    const overlay = document.createElement('div');
    overlay.className = 'manga-dl-scroll-overlay';
    overlay.innerHTML = `
      <div class="manga-dl-scroll-box">
        <div class="manga-dl-scroll-title">Tải Dữ Liệu Trang Web</div>
        <div class="manga-dl-scroll-desc">Đang tự động cuộn trang để kích hoạt tải ảnh Lazy-Load và bộ nhớ Canvas... Vui lòng đợi trong giây lát.</div>
        <div class="manga-dl-scroll-progress-bar">
          <div class="manga-dl-scroll-progress-fill" id="manga-dl-scroll-progress-fill"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.classList.add('active'), 10);
    
    const progressFill = overlay.querySelector('#manga-dl-scroll-progress-fill');
    
    const step = 800;
    const delay = 40;
    let currentScroll = 0;
    
    captureVisibleCanvases();
    
    while (true) {
      const currentTotalHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        totalHeight
      );
      if (currentScroll >= currentTotalHeight) {
        break;
      }
      window.scrollTo(0, currentScroll);
      captureVisibleCanvases();
      currentScroll += step;
      
      const percent = Math.min(100, Math.round((currentScroll / currentTotalHeight) * 100));
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    window.scrollTo(0, document.documentElement.scrollHeight);
    if (progressFill) progressFill.style.width = '100%';
    captureVisibleCanvases();
    await new Promise(resolve => setTimeout(resolve, 150));
    captureVisibleCanvases();
    
    window.scrollTo(0, originalScrollY);
    await new Promise(resolve => setTimeout(resolve, 150));
    captureVisibleCanvases();
    
    overlay.classList.remove('active');
    await new Promise(resolve => setTimeout(resolve, 300));
    overlay.remove();
    state.isScrolling = false;
  }

  function getMetadata() {
    const state = getSharedState();
    let title = 'Manga';
    let chapter = 'Chapter';
    
    if (state.matchedSite) {
      if (state.matchedSite.titleSelector) {
        try {
          const el = document.querySelector(state.matchedSite.titleSelector);
          if (el) title = el.textContent.trim();
        } catch (e) {}
      }
      if (state.matchedSite.chapterSelector) {
        try {
          const el = document.querySelector(state.matchedSite.chapterSelector);
          if (el) chapter = el.textContent.trim();
        } catch (e) {}
      }
    }
    
    if (title === 'Manga' || !title) {
      title = document.title.split(/[-|]/)[0].trim();
    }
    
    return { title, chapter };
  }

  function getImages() {
    const state = getSharedState();
    if (state.pageChapterImages && state.pageChapterImages.length > 0) {
      return state.pageChapterImages;
    }
    if (!state.matchedSite || !state.matchedSite.imageSelector) return [];

    const images = [];
    const selectors = state.matchedSite.imageSelector.split(',');
    const attributes = (state.matchedSite.imageUrlAttribute || 'src').split('|');

    selectors.forEach(sel => {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(sel.trim()));
      } catch (error) {
        // Ignored
      }

      nodes.forEach(img => {
        let src = '';

        if (img.tagName && img.tagName.toLowerCase() === 'canvas') {
          const pageIndex = getCanvasPageIndex(img);
          if (pageIndex !== -1 && state.canvasCache[pageIndex]) {
            src = state.canvasCache[pageIndex];
          } else {
            try {
              if (img.width > 100 && img.height > 100) {
                const canvasData = img.toDataURL('image/jpeg', 0.85);
                if (canvasData && canvasData.startsWith('data:')) {
                  src = canvasData;
                }
              }
            } catch (e) {
              // Ignored
            }
          }
        } else {
          for (const attr of attributes) {
            const val = img.getAttribute(attr.trim());
            const safeVal = Security.normalizeUrl(val, { baseUrl: window.location.href, allowHttp: true, allowProtocolRelative: true });
            if (safeVal) {
              src = safeVal;
              break;
            }
          }
          
          if (!src && img.src) {
            src = Security.normalizeUrl(img.src, { baseUrl: window.location.href, allowHttp: true });
          }
        }

        if (src && !images.includes(src)) {
          images.push(src);
        }
      });
    });

    return images;
  }

  function isChapterPage() {
    const state = getSharedState();
    if (!state.matchedSite) return false;

    const pathname = window.location.pathname;
    if (pathname === '/' || pathname === '' || pathname === '/index.html' || pathname === '/index.php') {
      return false;
    }

    if (!state.matchedSite.chapterUrlPattern) {
      // Heuristic fallback if pattern is not configured
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length === 0) return false;

      const lastSegment = segments[segments.length - 1].toLowerCase();
      const firstSegment = segments[0].toLowerCase();

      // Common non-chapter static pages
      const staticPages = new Set([
        'search', 'search-advanced', 'genres', 'tags', 'settings', 'auth', 'login', 'register',
        'history', 'recently-updated', 'recently-added', 'recently-updated-chapter', 'random-title',
        'offline', 'offline.html', 'home', 'about', 'contact', 'faq'
      ]);
      if (staticPages.has(lastSegment) || staticPages.has(firstSegment)) {
        return false;
      }

      // Explicit chapter viewer path prefixes (e.g. /chapter-detail/...)
      const chapterPrefixes = /^(?:chapter|chap|chuong|read|viewer|chapter-detail)$/i;
      if (chapterPrefixes.test(firstSegment) && segments.length >= 2) {
        return true;
      }

      // Exclude generic details prefixes (e.g. /manga/one-piece or /truyen/one-piece)
      const infoPrefixes = /^(?:manga|truyen|title|series|comic|book|info|show|detail|details)(?:-details?|s)?$/i;
      const isDetailsPrefix = infoPrefixes.test(firstSegment);

      // Check if the segment contains a clear chapter indicator followed by a number
      // We restrict 'v' and 'c' prefixes to have word boundaries and limit digit length to avoid matching long hex string hashes/IDs
      const chapterKeywordRegex = /(?:chap|chapter|chuong|ep|episode|tập|tap|vol)[_-]?\d+|(?:^|[^a-zA-Z0-9])(?:v|c)[_-]?\d{1,5}(?!\d)/i;
      const hasChapterKeyword = chapterKeywordRegex.test(lastSegment);

      // Pure number as last segment (e.g. /manga/one-piece/100)
      const isPureNumber = /^\d+(?:\.\d+)?$/.test(lastSegment);

      if (isDetailsPrefix) {
        if (segments.length === 2) {
          // If details prefix with 2 segments (e.g., /manga/one-piece-2), it is a details page unless it has a clear keyword
          return hasChapterKeyword;
        }
        // e.g. /manga/one-piece/100 or /manga/one-piece/chapter-100
        return hasChapterKeyword || isPureNumber;
      }

      // Non-standard path structures
      if (hasChapterKeyword) return true;
      if (isPureNumber && segments.length >= 2) return true;

      // Check if any segment has chapter keyword + number
      return segments.some(seg => chapterKeywordRegex.test(seg));
    }
    return Security.safeRegexTest(state.matchedSite.chapterUrlPattern, window.location.href);
  }


  // Export to global scope
  root.MangaDownloader = {
    fetchBlobAsDataUrl,
    fetchImageAsDataUrlSafe,
    loadImage,
    mergeImageGroup,
    autoScrollPage,
    getMetadata,
    getImages,
    isChapterPage
  };
})(typeof window !== 'undefined' ? window : this);
