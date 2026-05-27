// Background Search Providers and Scrapers
(function (root) {
  'use strict';

  const Security = root.MangaSecurity || {};
  const Utils = root.BgUtils || {};
  const Network = root.BgNetwork || {};
  const Fallback = root.BgSearchFallback || {};

  let activeSearchController = null;
  const searchCache = new Map();
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  function getCacheKey(query, nsfwActive, targetSites) {
    const sortedTargets = Array.isArray(targetSites) ? [...targetSites].sort().join(',') : 'all';
    return `${query.trim().toLowerCase()}_${nsfwActive ? 'nsfw' : 'sfw'}_${sortedTargets}`;
  }

  function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, val] of searchCache.entries()) {
      if (now - val.timestamp > CACHE_DURATION) {
        searchCache.delete(key);
      }
    }
  }



  /**
   * Detects when a search request was redirected to a single manga detail page
   * (common behavior on MangaKatana, and other sites when exactly 1 result matches).
   * Extracts manga info from the detail page and returns it as a single search result.
   * Returns null if the HTML does not appear to be a detail page.
   */
  function tryExtractSingleMangaResult(html, site, siteKey) {
    if (!html) return null;

    // Heuristic: a detail page usually has og:url or canonical pointing to a /manga/ path,
    // and does NOT have a typical search-results container with many items.
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:url["']/i);

    if (!canonicalMatch) return null;
    const canonicalUrl = canonicalMatch[1];

    // Check if the canonical URL looks like a manga detail page (not a search/homepage)
    const mangaPathPatterns = ['/manga/', '/truyen-tranh/', '/truyen/', '/series/', '/comic/', '/title/', '/webtoon/'];
    const isMangaPath = mangaPathPatterns.some(p => canonicalUrl.includes(p));
    if (!isMangaPath) return null;

    // Extract title from og:title or <h1>
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
                      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    let title = '';
    if (ogTitleMatch) {
      title = ogTitleMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").trim();
    } else if (h1Match) {
      title = h1Match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    }
    if (!title) return null;

    // Remove common site name suffixes from title
    const siteName = site.name || siteKey;
    title = title.replace(new RegExp(`\\s*[-–|]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '').trim();

    // Extract cover/thumbnail from og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                       || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    let thumbnail = '';
    if (ogImageMatch) {
      const domain = site.domainPattern ? site.domainPattern.replace(/\\/g, '') : `${siteKey}.com`;
      thumbnail = Utils.normalizeTrustedHttpUrl(ogImageMatch[1], [domain], site.referer || `https://${siteKey}.com/`);
    }

    // Validate the URL belongs to this site
    const domain = site.domainPattern ? site.domainPattern.replace(/\\/g, '').split('|')[0] : `${siteKey}.com`;
    if (!canonicalUrl.includes(domain)) return null;

    console.log(`Manga Downloader: Search for ${siteKey} redirected to detail page. Extracted: "${title}"`);

    // Extract authors/artists dynamically
    let author = '';

    // Check if the site has a configured searchAuthorSelector
    if (site.searchAuthorSelector) {
      const parts = site.searchAuthorSelector.trim().split(/\s+/);
      let targetClass = '';
      let targetTag = '';
      parts.forEach(p => {
        if (p.startsWith('.') || p.startsWith('#')) targetClass = p.replace(/^[.#]/, '');
        else targetTag = p;
      });
      if (targetClass) {
        const regex = new RegExp(`<${targetTag || '[^>]+'}[^>]*class=["'][^"']*${targetClass}[^"']*["'][^>]*>([^<]+)<\/${targetTag || '[^>]+'}>`, 'ig');
        const matches = [...html.matchAll(regex)];
        if (matches.length > 0) {
          author = matches.map(m => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()).join(', ');
        }
      }
    }
    
    // Heuristic 1: Look for class="author" links or elements
    if (!author) {
      const authorMatches = [...html.matchAll(/<a[^>]+class=["'](?:[^"']*?\s)?author(?:\s[^"']*?)?["'][^>]*>([^<]+)<\/a>/ig)];
      if (authorMatches.length > 0) {
        author = authorMatches.map(m => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()).join(', ');
      }
    }
    
    // Heuristic 2: Look for labels containing "Author" or "Tác giả" followed by value/links
    if (!author) {
      const authorLabelMatch = html.match(/(?:Author|Artist|Tác giả|Tác giả\s*\/\s*Họa sĩ|Creator)(?:s)?\s*:\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i)
                            || html.match(/(?:Author|Artist|Tác giả|Tác giả\s*\/\s*Họa sĩ|Creator)(?:s)?\s*:\s*<span[^>]*>([\s\S]*?)<\/span>/i)
                            || html.match(/<li>\s*<span[^>]*>(?:Author|Tác giả|Creator)[^<]*<\/span>\s*:\s*([\s\S]*?)<\/li>/i)
                            || html.match(/<div[^>]*class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (authorLabelMatch) {
        author = authorLabelMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }
    }

    if (!author || author.toLowerCase().includes('unknown') || author.trim() === '') {
      author = 'Nhiều tác giả';
    }

    return [{
      title,
      author,
      thumbnail: thumbnail || '',
      url: canonicalUrl,
      source: siteName,
      sourceKey: siteKey
    }];
  }

  // Helper to extract text from a raw HTML chunk based on selector class/tag hints
  function extractTextFromChunk(chunk, selector) {
    if (!selector) return '';
    
    // Clean and split the selector (e.g. ".post-author a" or ".author")
    const parts = selector.trim().split(/\s+/);
    if (parts.length === 0) return '';
    
    // Find classes and tags in the selector parts
    let targetClass = '';
    let targetTag = '';
    
    // Look at the last part or last couple of parts
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part.startsWith('.') || part.startsWith('#')) {
        targetClass = part.replace(/^[.#]/, '');
        break;
      } else {
        targetTag = part;
      }
    }
    
    if (targetClass) {
      // Find wrapper with this class
      const classRegex = new RegExp(`class=["'][^"']*${targetClass}[^"']*["'][^>]*>([\\s\\S]*?)<\/(?:div|span|p|a|li|h1|h2|h3|h4|h5|h6|section)>`, 'i');
      const match = chunk.match(classRegex)
                 || chunk.match(new RegExp(`class=["'][^"']*${targetClass}[^"']*["'][^>]*>\\s*([^<]+)`, 'i'));
      if (match) {
        const val = match[1];
        if (targetTag) {
          // Find nested tag
          const tagRegex = new RegExp(`<${targetTag}[^>]*>([\\s\\S]*?)<\/${targetTag}>`, 'i')
                        || new RegExp(`<${targetTag}[^>]*>\\s*([^<]+)`, 'i');
          const tagMatch = val.match(tagRegex);
          if (tagMatch) {
            return tagMatch[1].replace(/<[^>]+>/g, '').trim();
          }
        }
        return val.replace(/<[^>]+>/g, '').trim();
      }
    } else if (targetTag) {
      const tagRegex = new RegExp(`<${targetTag}[^>]*>([\\s\\S]*?)<\/${targetTag}>`, 'i')
                    || new RegExp(`<${targetTag}[^>]*>\\s*([^<]+)`, 'i');
      const tagMatch = chunk.match(tagRegex);
      if (tagMatch) {
        return tagMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }
    
    return '';
  }

  // Generic parser for custom sites using their configured selectors
  function parseCustomSearchHtml(html, site, siteKey) {
    const results = [];
    if (!site.searchUrl || !site.searchResultSelector) return results;

    const selectorParts = site.searchResultSelector.split(/\s+/);
    const targetSelector = selectorParts[selectorParts.length - 1];
    const cleanClassName = targetSelector.replace(/^[.#]/, '').replace(/div|span|li|article/g, '');
    
    let chunks = [];
    if (cleanClassName) {
      chunks = html.split(new RegExp(`class=["'][^"']*${cleanClassName}[^"']*["']`, 'i'));
      chunks.shift();
    } else {
      chunks = html.split(/<div class=["']manga-item|item|post-item|card["']/i);
      chunks.shift();
    }

    chunks = chunks.slice(0, 20);
    const domain = site.domainPattern ? site.domainPattern.replace(/\\/g, '') : `${siteKey}.com`;

    chunks.forEach(chunk => {
      const hrefMatch = chunk.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) return;
      const href = hrefMatch[1];
      const itemUrl = Utils.normalizeTrustedHttpUrl(href, [domain], site.referer || `https://${siteKey}.com/`);
      if (!itemUrl) return;

      let title = '';
      if (site.searchTitleSelector) {
        title = extractTextFromChunk(chunk, site.searchTitleSelector);
      }
      if (!title) {
        const titleMatch = chunk.match(/title=["']([^"']+)["']/i) || chunk.match(/<a[^>]+>([^<]+)<\/a>/i);
        if (titleMatch) title = titleMatch[1].trim();
      }
      title = (title || 'Manga Title').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

      let thumbnail = '';
      if (site.searchCoverSelector) {
        const coverParts = site.searchCoverSelector.split(/\s+/);
        let imgClass = '';
        coverParts.forEach(p => {
          if (p.startsWith('.') || p.startsWith('#')) imgClass = p.replace(/^[.#]/, '');
        });
        
        let subChunk = chunk;
        if (imgClass) {
          const match = chunk.match(new RegExp(`class=["'][^"']*${imgClass}[^"']*["'][^>]*>[\\s\\S]*?<img[^>]+>`, 'i'))
                     || chunk.match(new RegExp(`class=["'][^"']*${imgClass}[^"']*["'][^>]*>([\\s\\S]*?)<\/(?:div|span|a)>`, 'i'));
          if (match) subChunk = match[0];
        }
        
        const imgMatch = subChunk.match(/<img[^>]+src=["']([^"']+)["']/i)
                      || subChunk.match(/src=["']([^"']+)["']/i)
                      || subChunk.match(/data-src=["']([^"']+)["']/i)
                      || subChunk.match(/data-original=["']([^"']+)["']/i);
        if (imgMatch) thumbnail = imgMatch[1];
      }
      if (!thumbnail) {
        const imgMatch = chunk.match(/src=["']([^"']+)["']/i) || chunk.match(/data-src=["']([^"']+)["']/i) || chunk.match(/data-original=["']([^"']+)["']/i);
        if (imgMatch) thumbnail = imgMatch[1];
      }
      if (thumbnail) {
        thumbnail = Utils.normalizeTrustedHttpUrl(thumbnail, [domain], site.referer || `https://${siteKey}.com/`);
      }

      let author = '';
      if (site.searchAuthorSelector) {
        author = extractTextFromChunk(chunk, site.searchAuthorSelector);
      }
      author = (author || 'Nhiều tác giả').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

      results.push({
        title,
        author,
        thumbnail,
        url: itemUrl,
        source: site.name || siteKey,
        sourceKey: siteKey
      });
    });

    return results;
  }

  async function sendSearchMessageToPopup(msg) {
    try {
      const state = root.currentSearchState;
      if (msg && msg.type === 'SEARCH_RESULTS_CHUNK') {
        const searchId = msg.searchId;
        const results = Array.isArray(msg.results) ? msg.results : [];
        if (searchId === state.searchId || searchId === state.nsfwSearchId) {
          const existingUrls = new Set(state.results.map(r => r.url));
          const uniqueNew = results.filter(r => !existingUrls.has(r.url));
          if (uniqueNew.length > 0) {
            state.results = state.results.concat(uniqueNew);
            await chrome.storage.local.set({ currentSearchState: state });
          }
        }
      } else if (msg && msg.type === 'SEARCH_CLOUDFLARE_BLOCKED') {
        const searchId = msg.searchId;
        if (searchId === state.searchId || searchId === state.nsfwSearchId) {
          state.blockedSites[msg.siteKey] = {
            sourceName: msg.sourceName,
            url: msg.url,
            isNsfw: msg.searchId === state.nsfwSearchId
          };
          await chrome.storage.local.set({ currentSearchState: state });
        }
      } else if (msg && msg.type === 'SEARCH_FINISHED') {
        const searchId = msg.searchId;
        const isCurrent = (searchId === state.searchId || searchId === state.nsfwSearchId);
        if (searchId === state.searchId) {
          state.finishedDefault = true;
          await chrome.storage.local.set({ currentSearchState: state });
        } else if (searchId === state.nsfwSearchId) {
          state.finishedNsfw = true;
          await chrome.storage.local.set({ currentSearchState: state });
        }

        if (isCurrent && state.query) {
          const cacheKey = getCacheKey(state.query, state.nsfwActive, state.targetSites);
          searchCache.set(cacheKey, {
            timestamp: Date.now(),
            results: [...state.results]
          });
        }
      }

      await chrome.runtime.sendMessage(msg);
    } catch (err) {
      // Popup closed
    }
  }

  // Polling Cloudflare verification page opened in a tab
  function startTabPolling(tabId, siteKey, url) {
    const activeTabs = root.activeVerificationTabs;
    const state = root.currentSearchState;
    
    if (activeTabs.has(tabId)) {
      const prev = activeTabs.get(tabId);
      clearInterval(prev.intervalId);
      clearTimeout(prev.timeoutId);
      activeTabs.delete(tabId);
    }

    let finished = false;

    const poll = async () => {
      if (finished) return;
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
          const { html, url: tabUrl, readyState } = results[0].result;
          if (html && readyState === 'complete') {
            const isCf = Network.checkHtmlForCloudflare(html);
            if (!isCf) {
              console.log(`[TAB_POLLING]: Captcha solved for ${siteKey}! Closing tab and re-triggering search.`);
              
              clearInterval(intervalId);
              clearTimeout(timeoutId);
              activeTabs.delete(tabId);
              finished = true;

              if (state.blockedSites[siteKey]) {
                delete state.blockedSites[siteKey];
              }

              const stored = await chrome.storage.local.get(['sites', 'nsfwActive']);
              const activeSites = stored.sites || {};
              const nsfwActive = Boolean(stored.nsfwActive);
              const site = activeSites[siteKey];
              const searchId = (site && site.isNsfw) ? state.nsfwSearchId : state.searchId;

              chrome.tabs.remove(tabId).catch(() => {});

              // Re-trigger the search for this site now that Cloudflare is cleared
              await chrome.storage.local.set({ currentSearchState: state });
              if (searchId) {
                console.log(`[TAB_POLLING]: Re-triggering search for ${siteKey} in background.`);
                streamSearchManga(state.query, searchId, activeSites, nsfwActive, [siteKey]);
              }
            }
          }
        }
      } catch (err) {
        console.log(`[TAB_POLLING]: Polling ${siteKey} on tab ${tabId}... (waiting for tab scripting support)`);
      }
    };

    const intervalId = setInterval(poll, 1500);
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      activeTabs.delete(tabId);
      console.warn(`[TAB_POLLING]: Polling timed out for ${siteKey} on tab ${tabId}.`);
    }, 90000);

    activeTabs.set(tabId, { siteKey, intervalId, timeoutId });
  }

  // Stream search results chunk-by-chunk
  async function streamSearchManga(query, searchId, activeSites = {}, nsfwActive = false, targetSites = null) {
    // 1. Abort any previous active search running in the background
    if (activeSearchController) {
      console.log('Manga Downloader: Cancelling previous running search fetches...');
      activeSearchController.abort();
    }
    activeSearchController = new AbortController();
    const signal = activeSearchController.signal;

    // 2. Check cache for quick results
    cleanExpiredCache();
    const cacheKey = getCacheKey(query, nsfwActive, targetSites);
    const cached = searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log(`Manga Downloader: Serving search results from cache for "${query}"`);
      if (cached.results && cached.results.length > 0) {
        await sendSearchMessageToPopup({
          type: 'SEARCH_RESULTS_CHUNK',
          searchId,
          results: cached.results
        });
      }
      await sendSearchMessageToPopup({
        type: 'SEARCH_FINISHED',
        searchId
      });
      return;
    }

    const promises = [];
    
    const shouldSearch = (key) => {
      const site = activeSites[key];
      if (!site) return false;
      if (site.isNsfw && !nsfwActive) return false;
      if (site.searchSupported === false) return false;
      if (targetSites && !targetSites.includes(key)) return false;
      return true;
    };

    /**
     * Derives the primary domain for a site from its config.
     * Uses domainPattern (first entry) or referer hostname, falling back to siteKey.com.
     */
    const deriveSiteDomain = (siteKey) => {
      const site = activeSites[siteKey];
      if (site && site.domainPattern) {
        return site.domainPattern.split('|')[0].replace(/\\/g, '');
      }
      if (site && site.referer) {
        try {
          return new URL(site.referer).hostname;
        } catch (_) { /* ignore */ }
      }
      return `${siteKey}.com`;
    };

    const handleSearchError = (siteKey, err) => {
      const errMsg = String(err && (err.message || err)).toLowerCase();
      if (errMsg.includes('abort') || (err && err.name === 'AbortError')) {
        return; // Normal cancellation, do nothing
      }
      console.error(`Error searching ${siteKey}:`, err);
      Utils.logBackgroundError(`search_${siteKey}`, err);

      const isCf = errMsg.includes('403') || 
                   errMsg.includes('503') || 
                   errMsg.includes('cloudflare') || 
                   errMsg.includes('just a moment') || 
                   errMsg.includes('challenge') ||
                   errMsg.includes('captcha') ||
                   errMsg.includes('bot protection') ||
                   errMsg.includes('access denied');

      if (isCf) {
        const site = activeSites[siteKey];
        let searchUrl = '';
        if (site && site.searchUrl) {
          searchUrl = site.searchUrl.replace('{query}', encodeURIComponent(query));
        } else if (site && site.referer) {
          searchUrl = site.referer;
        } else {
          searchUrl = `https://${deriveSiteDomain(siteKey)}/`;
        }
        
        sendSearchMessageToPopup({
          type: 'SEARCH_CLOUDFLARE_BLOCKED',
          searchId,
          siteKey,
          sourceName: site ? site.name : siteKey,
          url: searchUrl
        }).catch(() => {});
      }
    };

    const handleSearchErrorWithYahooFallback = async (siteKey, err) => {
      const errMsg = String(err && (err.message || err)).toLowerCase();
      if (errMsg.includes('abort') || (err && err.name === 'AbortError')) {
        return; // Normal cancellation, do nothing
      }
      console.error(`Error searching ${siteKey}:`, err);
      Utils.logBackgroundError(`search_${siteKey}`, err);

      const isCfError = errMsg.includes('403') || 
                   errMsg.includes('503') || 
                   errMsg.includes('cloudflare') || 
                   errMsg.includes('just a moment') || 
                   errMsg.includes('challenge') ||
                   errMsg.includes('captcha') ||
                   errMsg.includes('bot protection') ||
                   errMsg.includes('access denied') ||
                   errMsg.includes('quá thời gian') ||
                   errMsg.includes('timeout');

      // Treat all sites equally — always attempt fallback on CF/timeout errors or empty/no results errors
      if (isCfError || errMsg.includes('no results')) {
        if (signal.aborted) return;
        console.log(`Manga Downloader: Direct search for ${siteKey} failed. Falling back to search engine...`);
        const site = activeSites[siteKey];
        const siteDomain = deriveSiteDomain(siteKey);
        
        // Helper to enrich results if needed (currently a passthrough since Naver was removed)
        const processResults = async (rawResults) => {
          return rawResults;
        };

        // Yahoo
        try {
          const yahooResults = await Fallback.searchViaYahoo(query, siteDomain, site ? site.name : siteKey, siteKey, signal);
          if (signal.aborted) return;
          if (yahooResults && yahooResults.length > 0) {
            console.log(`Manga Downloader: Yahoo fallback succeeded for ${siteKey} with ${yahooResults.length} results.`);
            const enriched = await processResults(yahooResults);
            if (signal.aborted) return;
            await sendSearchMessageToPopup({ type: 'SEARCH_RESULTS_CHUNK', searchId, results: Utils.normalizeSearchResults(enriched) });
            return;
          }
        } catch (yahooErr) {
          if (yahooErr.name !== 'AbortError') {
            console.warn(`Manga Downloader: Yahoo fallback failed for ${siteKey}:`, yahooErr.message);
          }
        }

        // DuckDuckGo Lite
        try {
          const ddgResults = await Fallback.searchViaDuckDuckGo(query, siteDomain, site ? site.name : siteKey, siteKey, signal);
          if (signal.aborted) return;
          if (ddgResults && ddgResults.length > 0) {
            console.log(`Manga Downloader: DuckDuckGo fallback succeeded for ${siteKey} with ${ddgResults.length} results.`);
            const enriched = await processResults(ddgResults);
            if (signal.aborted) return;
            await sendSearchMessageToPopup({ type: 'SEARCH_RESULTS_CHUNK', searchId, results: Utils.normalizeSearchResults(enriched) });
            return;
          }
        } catch (ddgErr) {
          if (ddgErr.name !== 'AbortError') {
            console.warn(`Manga Downloader: DuckDuckGo fallback failed for ${siteKey}:`, ddgErr.message);
          }
        }

        // Google
        try {
          const googleResults = await Fallback.searchViaGoogle(query, siteDomain, site ? site.name : siteKey, siteKey, signal);
          if (signal.aborted) return;
          if (googleResults && googleResults.length > 0) {
            console.log(`Manga Downloader: Google fallback succeeded for ${siteKey} with ${googleResults.length} results.`);
            const enriched = await processResults(googleResults);
            if (signal.aborted) return;
            await sendSearchMessageToPopup({ type: 'SEARCH_RESULTS_CHUNK', searchId, results: Utils.normalizeSearchResults(enriched) });
            return;
          }
        } catch (googleErr) {
          if (googleErr.name !== 'AbortError') {
            console.warn(`Manga Downloader: Google fallback failed for ${siteKey}:`, googleErr.message);
          }
        }
      }

      if (signal.aborted) return;
      handleSearchError(siteKey, err);
    };

    // Search all configured sites using the generic custom-site approach
    Object.keys(activeSites).forEach(key => {
      if (shouldSearch(key)) {
        const site = activeSites[key];



        if (site.searchSupported && site.searchUrl) {
          promises.push((async () => {
            const siteResults = [];
            try {
              if (signal.aborted) return;
              const searchUrl = site.searchUrl.replace('{query}', encodeURIComponent(query));
              const html = await Network.fetchHtmlWithFallback({ url: searchUrl, referer: site.referer || searchUrl, timeout: 6000, signal });
              if (signal.aborted) return;
              const items = parseCustomSearchHtml(html, site, key);
              items.forEach(item => siteResults.push(item));
              if (siteResults.length === 0) {
                // Check if search redirected to a single manga detail page
                const singleResult = tryExtractSingleMangaResult(html, site, key);
                if (singleResult) {
                  singleResult.forEach(item => siteResults.push(item));
                }
              }
              if (siteResults.length > 0) {
                await sendSearchMessageToPopup({ type: 'SEARCH_RESULTS_CHUNK', searchId, results: Utils.normalizeSearchResults(siteResults) });
              } else {
                console.log(`Manga Downloader: Direct search for ${key} returned 0 results. Triggering search engine fallback...`);
                await handleSearchErrorWithYahooFallback(key, new Error('No results from direct search'));
              }
            } catch (err) {
              await handleSearchErrorWithYahooFallback(key, err);
            }
          })());
        }
      }
    });

    await Promise.allSettled(promises);
    if (signal.aborted) return;
    await sendSearchMessageToPopup({ type: 'SEARCH_FINISHED', searchId });
  }

  // Export functions
  root.BgSearchProviders = {
    parseCustomSearchHtml,
    sendSearchMessageToPopup,
    startTabPolling,
    streamSearchManga
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
