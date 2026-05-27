// Background Network and Fetching logic
(function (root) {
  'use strict';

  const Security = root.MangaSecurity || {};
  const Utils = root.BgUtils || {};

  let isCreatingOffscreen = null;
  let offscreenQueue = Promise.resolve();

  // Bypasses referer restrictions and fetches the image as a base64 data URL via Offscreen Document
  async function fetchImageWithReferer({ url, referer, timeout = 15000 }) {
    const ruleId = Utils.getNextDnrRuleId();

    const requestHeaders = [
      { header: 'User-Agent', operation: 'set', value: navigator.userAgent }
    ];
    if (referer) {
      requestHeaders.push({ header: 'Referer', operation: 'set', value: referer });
      requestHeaders.push({ header: 'Origin', operation: 'set', value: new URL(referer).origin });
    }

    const rule = {
      id: ruleId,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        requestHeaders
      },
      condition: {
        urlFilter: url.split('?')[0],
        initiatorDomains: [chrome.runtime.id],
        resourceTypes: ['xmlhttprequest', 'other', 'image']
      }
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule]
    });

    try {
      await getOrCreateOffscreen();

      let ready = false;
      for (let i = 0; i < 10; i++) {
        try {
          const pingResponse = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PING' });
          if (pingResponse && pingResponse.success) {
            ready = true;
            break;
          }
        } catch (err) {}
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'FETCH_IMAGE',
        data: { url, timeout }
      });

      if (response && response.success) {
        return response.dataUrl;
      } else {
        throw new Error((response && response.error) || 'Không thể tải ảnh qua Offscreen Document.');
      }
    } finally {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId]
      });
    }
  }

  // Helper to get cookies for a URL's domain from chrome.cookies API
  async function getCookiesForUrl(url) {
    if (typeof chrome === 'undefined' || !chrome.cookies) return '';
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }
      const cookies = await chrome.cookies.getAll({ domain });
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } catch (e) {
      console.warn('Failed to get cookies for URL:', url, e);
      return '';
    }
  }

  // Bypasses referer restrictions and fetches HTML content with cookie support
  async function fetchHtmlWithReferer({ url, referer, timeout = 15000, signal }) {
    const urlObj = new URL(url);
    const ruleId = Utils.getNextDnrRuleId();

    let cookieHeaderValue = '';
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      cookieHeaderValue = await getCookiesForUrl(url);
    }

    const requestHeaders = [
      { header: 'User-Agent', operation: 'set', value: navigator.userAgent }
    ];
    if (referer) {
      requestHeaders.push({ header: 'Referer', operation: 'set', value: referer });
      requestHeaders.push({ header: 'Origin', operation: 'set', value: new URL(referer).origin });
    }
    if (cookieHeaderValue) {
      requestHeaders.push({ header: 'Cookie', operation: 'set', value: cookieHeaderValue });
    }

    let cleanDomain = urlObj.hostname;
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.substring(4);
    }
    const escapedDomain = Utils.escapeDnrRegex(cleanDomain);
    const regexFilter = `^https?://([^/]+\\.)?${escapedDomain}/`;

    const rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders
      },
      condition: {
        regexFilter,
        resourceTypes: ['xmlhttprequest', 'other']
      }
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule]
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          controller.abort();
        }, { once: true });
      }
    }

    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'include' });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return text;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    } finally {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId]
      });
    }
  }

  async function getOrCreateOffscreen() {
    try {
      const matchedClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'all' });
      for (const client of matchedClients) {
        if (client.url.indexOf(chrome.runtime.getURL('background/offscreen.html')) !== -1) {
          return;
        }
      }
    } catch (e) {
      console.warn('Manga Downloader: Error checking matched clients:', e);
    }

    if (isCreatingOffscreen) {
      try {
        await isCreatingOffscreen;
      } catch (e) {}
      return;
    }

    isCreatingOffscreen = chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Yêu cầu DOM để chạy iframe ngầm tải trang và vượt qua Cloudflare.'
    });

    try {
      await isCreatingOffscreen;
    } catch (err) {
      if (!err.message.includes('Only one offscreen document')) {
        throw err;
      }
    } finally {
      isCreatingOffscreen = null;
    }
  }

  async function fetchHtmlViaOffscreen({ url, referer, timeout = 15000 }) {
    return new Promise((resolve, reject) => {
      offscreenQueue = offscreenQueue.then(async () => {
        try {
          const html = await fetchHtmlViaOffscreenInternal({ url, referer, timeout });
          resolve(html);
        } catch (err) {
          reject(err);
        }
      }).catch(err => {
        console.error('Manga Downloader: Offscreen task queue error:', err);
      });
    });
  }

  async function fetchHtmlViaOffscreenInternal({ url, referer, timeout = 15000 }) {
    const urlObj = new URL(url);
    const ruleId = Utils.getNextDnrRuleId();

    const rule = {
      id: ruleId,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: referer || urlObj.origin },
          { header: 'Origin', operation: 'set', value: new URL(referer || url).origin },
          { header: 'User-Agent', operation: 'set', value: navigator.userAgent }
        ],
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' }
        ]
      },
      condition: {
        regexFilter: `^https?://([^/]+\\.)?${Utils.escapeDnrRegex(urlObj.hostname)}`,
        initiatorDomains: [chrome.runtime.id],
        resourceTypes: ['sub_frame']
      }
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule]
    });

    try {
      await getOrCreateOffscreen();

      let ready = false;
      for (let i = 0; i < 10; i++) {
        try {
          const pingResponse = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PING' });
          if (pingResponse && pingResponse.success) {
            ready = true;
            break;
          }
        } catch (err) {}
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!ready) {
        console.warn('Manga Downloader: Warning: Offscreen document ready ping timed out.');
      }

      const requestId = Math.random().toString(36).substring(2, 15);
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'LOAD_URL',
        data: { url, requestId, timeout }
      });

      if (response && response.success) {
        return response.html;
      } else {
        throw new Error((response && response.error) || 'Không thể tải trang qua Offscreen Document.');
      }
    } finally {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId]
      });
    }
  }

  function checkHtmlForCloudflare(html) {
    if (!html) return false;
    
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().toLowerCase() : '';
    if (title === 'just a moment...' || 
        title === 'attention required! | cloudflare' || 
        title.includes('cloudflare protection') || 
        title === 'please wait...' || 
        title === 'ddos-guard') {
      return true;
    }
    
    const lower = html.toLowerCase();
    
    if (lower.includes('cf-turnstile-response') || 
        lower.includes('cf-chl-widget-') || 
        lower.includes('id="cf-challenge"') || 
        lower.includes('class="cf-browser-verification"') ||
        lower.includes('id="challenge-running"') ||
        lower.includes('id="challenge-error-text"') ||
        lower.includes('class="lds-ring"') ||
        lower.includes('class="lds-dual-ring"') ||
        lower.includes('cf-error-details') ||
        lower.includes('id="challenge-form"') ||
        (lower.includes('ddos-guard') && (lower.includes('dg-customer') || lower.includes('check.ddos-guard')))) {
      return true;
    }
    
    return false;
  }

  function fetchHtmlViaTab(url, timeout = 25000) {
    return new Promise((resolve, reject) => {
      let tabId = null;
      let finished = false;

      const cleanup = () => {
        finished = true;
        if (intervalId) clearInterval(intervalId);
        chrome.tabs.onRemoved.removeListener(onRemovedListener);
        if (tabId) {
          chrome.tabs.remove(tabId).catch(() => {});
        }
      };

      const timeoutId = setTimeout(() => {
        if (!finished) {
          cleanup();
          reject(new Error('Cloudflare challenge page detected'));
        }
      }, timeout);

      const onRemovedListener = (removedTabId) => {
        if (removedTabId === tabId && !finished) {
          clearTimeout(timeoutId);
          finished = true;
          if (intervalId) clearInterval(intervalId);
          chrome.tabs.onRemoved.removeListener(onRemovedListener);
          reject(new Error('Người dùng đã đóng tab xác thực.'));
        }
      };

      let intervalId = null;
      let cfCount = 0;

      const poll = async () => {
        if (!tabId || finished) return;
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => ({
              html: document.documentElement.outerHTML,
              url: window.location.href,
              readyState: document.readyState
            })
          });
          if (results && results[0] && results[0].result) {
            const { html, readyState } = results[0].result;
            if (html && readyState === 'complete') {
              const isCf = checkHtmlForCloudflare(html);
              if (!isCf) {
                clearTimeout(timeoutId);
                cleanup();
                resolve(html);
              } else {
                cfCount++;
                if (cfCount >= 3) {
                  console.log(`[TAB_POLLING]: Cloudflare detected continuously in background tab. Failing fast...`);
                  clearTimeout(timeoutId);
                  cleanup();
                  reject(new Error('Cloudflare challenge page detected'));
                }
              }
            }
          }
        } catch (err) {
          // Tab might be navigating, ignore
        }
      };

      chrome.tabs.onRemoved.addListener(onRemovedListener);

      chrome.tabs.create({ url, active: false }, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          clearTimeout(timeoutId);
          finished = true;
          chrome.tabs.onRemoved.removeListener(onRemovedListener);
          reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Không thể tạo tab mới.'));
        } else {
          tabId = tab.id;
          setTimeout(() => {
            if (!finished) {
              intervalId = setInterval(poll, 2000);
            }
          }, 3000);
        }
      });
    });
  }

  async function fetchHtmlWithFallback({ url, referer, timeout = 15000, useTabFallback = false, signal }) {
    let html;
    let isCf = false;
    try {
      html = await fetchHtmlWithReferer({ url, referer, timeout, signal });
      isCf = checkHtmlForCloudflare(html);
    } catch (error) {
      console.warn(`FETCH_HTML: Thử tải trực tiếp thất bại cho ${url}. Lỗi:`, error.message);
      if (error.name === 'AbortError' || signal?.aborted) {
        throw error;
      }
    }

    if ((!html || isCf) && useTabFallback) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      console.log(`FETCH_HTML: Tải trực tiếp thất bại hoặc phát hiện Cloudflare cho ${url}. Chuyển sang dùng Tab Helper...`);
      try {
        html = await fetchHtmlViaTab(url, Math.max(timeout, 30000));
      } catch (tabError) {
        console.error(`FETCH_HTML: Tải qua Tab cũng thất bại cho ${url}. Lỗi:`, tabError.message);
        throw tabError;
      }
    }

    if (html && checkHtmlForCloudflare(html)) {
      throw new Error('Cloudflare challenge page detected');
    }
    return html;
  }

  // Export functions to global scope
  root.BgNetwork = {
    fetchImageWithReferer,
    getCookiesForUrl,
    fetchHtmlWithReferer,
    fetchHtmlViaOffscreen,
    checkHtmlForCloudflare,
    fetchHtmlViaTab,
    fetchHtmlWithFallback
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
