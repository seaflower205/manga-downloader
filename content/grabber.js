// Grabber script running in the MAIN world to access page global variables
// Uses a hidden DOM element as a bridge to pass data to the ISOLATED world content script
(function () {
  const BRIDGE_ID = '__manga_dl_bridge__';

  const IGNORED_KEYS = new Set([
    'window', 'self', 'document', 'location', 'top', 'parent', 'frames', 'opener',
    'chrome', 'navigator', 'external', 'history', 'performance', 'console',
    'localStorage', 'sessionStorage', 'indexedDB', 'webkitStorageInfo', 'webkitIndexedDB',
    'MangaSecurity', 'BgUtils', 'BgNetwork', 'BgSearchProviders', 'MangaDetector', 'MangaDownloader', 'MangaUI'
  ]);

  function findImageArrays(obj, visited = new Set(), depth = 0) {
    if (depth > 3 || !obj || typeof obj !== 'object' || visited.has(obj)) return [];
    visited.add(obj);

    let results = [];
    for (const key in obj) {
      if (depth === 0 && IGNORED_KEYS.has(key)) continue;
      try {
        const val = obj[key];
        if (!val) continue;
        if (Array.isArray(val) && val.length >= 3) {
          const first = val[0];
          if (typeof first === 'string' && (first.startsWith('http') || first.startsWith('//') || first.startsWith('/')) && /\.(?:jpe?g|png|webp|gif|bmp)(?:\?.*)?$/i.test(first)) {
            const isAllUrls = val.slice(0, 3).every(item => typeof item === 'string' && (item.startsWith('http') || item.startsWith('//') || item.startsWith('/')));
            if (isAllUrls) {
              results.push(val);
            }
          }
        } else if (typeof val === 'object') {
          // Avoid traversing DOM elements
          if (val instanceof Node || val.nodeType !== undefined) continue;
          const nested = findImageArrays(val, visited, depth + 1);
          if (nested.length > 0) {
            results = results.concat(nested);
          }
        }
      } catch (e) {}
    }
    return results;
  }

  const sendData = () => {
    let images = [];

    // 1. Check known traditional variables
    if (typeof chapterImages !== 'undefined' && Array.isArray(chapterImages) && chapterImages.length > 0) {
      images = chapterImages;
    } else if (typeof thzq !== 'undefined' && Array.isArray(thzq) && thzq.length > 0) {
      images = thzq;
    }

    // 2. Check matched site's specific JSON variable
    if (images.length === 0) {
      try {
        const matchedSiteStr = document.documentElement.getAttribute('data-matched-site-info');
        if (matchedSiteStr) {
          const matchedSite = JSON.parse(matchedSiteStr);
          if (matchedSite && matchedSite.imagesJsonVariable) {
            const paths = matchedSite.imagesJsonVariable.split('.');
            let curr = window;
            for (const p of paths) {
              if (curr) curr = curr[p];
            }
            if (Array.isArray(curr) && curr.length > 0) {
              images = curr;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: recursively scan window for arrays of image URLs (handles NEXT_DATA, NUXT, React/Redux states)
    if (images.length === 0) {
      try {
        const found = findImageArrays(window);
        if (found.length > 0) {
          let longest = [];
          found.forEach(arr => {
            if (arr.length > longest.length) longest = arr;
          });
          images = longest;
        }
      } catch (e) {}
    }

    // 4. Send to DOM bridge if images found
    if (images.length > 0) {
      let bridge = document.getElementById(BRIDGE_ID);
      if (!bridge) {
        bridge = document.createElement('script');
        bridge.id = BRIDGE_ID;
        bridge.type = 'application/json';
        bridge.style.display = 'none';
        (document.head || document.documentElement).appendChild(bridge);
      }
      bridge.textContent = JSON.stringify(images);
    }
  };

  // Try immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendData);
  } else {
    sendData();
  }

  // Also on full load
  window.addEventListener('load', sendData);

  // Poll for late initialization (some sites set variables after AJAX fetches)
  let checks = 0;
  const interval = setInterval(() => {
    sendData();
    if (++checks > 30) {
      clearInterval(interval);
    }
  }, 300);

  // Listen for navigation requests from the content script
  document.addEventListener('manga-dl-navigate', (e) => {
    if (e.detail && e.detail.direction) {
      if (e.detail.direction === 'prev' && typeof window.BBAppPrevPage === 'function') {
        window.BBAppPrevPage();
      } else if (e.detail.direction === 'next' && typeof window.BBAppNextPage === 'function') {
        window.BBAppNextPage();
      }
    }
  });
})();
