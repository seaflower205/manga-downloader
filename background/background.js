// Background Service Worker for Manga Downloader Premium
importScripts('../utils/jszip.min.js', '../utils/security.js');

const Security = self.MangaSecurity;
let nextDnrRuleId = Math.floor(Date.now() % 1000000) + 2000;
const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FETCH_IMAGE_BYTES = Math.floor(Security.DEFAULT_LIMITS.dataUrl * 0.75);

function isAllowedImageContentType(value) {
  const type = Security.toSafeString(value, 80).toLowerCase().split(';')[0].trim();
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
  return Security.toSafeString(value, Security.DEFAULT_LIMITS.url)
    .replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function getNextDnrRuleId() {
  nextDnrRuleId += 1;
  if (nextDnrRuleId > 1000000000) nextDnrRuleId = 2001;
  return nextDnrRuleId;
}

function logBackgroundError(feature, error, metadata = {}) {
  Security.logDiagnostic({ feature, error, metadata }).catch(() => {});
}

function sanitizeSitesForStorage(rawSites) {
  const result = Security.sanitizeSiteMap(rawSites);
  if (result.skipped.length > 0) {
    Security.logDiagnostic({
      feature: 'site_config_validation',
      metadata: { skipped: result.skipped.join(',') }
    }).catch(() => {});
  }
  return result;
}

// Helper to initialize and merge site profiles from sites.json
async function initializeSites() {
  try {
    const response = await fetch(chrome.runtime.getURL('config/sites.json'));
    const defaultSites = sanitizeSitesForStorage(await response.json()).sites;
    const stored = await chrome.storage.local.get('sites');
    if (!stored.sites) {
      await chrome.storage.local.set({ sites: defaultSites });
      console.log('Default site profiles imported.');
    } else {
      // Merge but keep user-defined/updated configurations
      const localSites = sanitizeSitesForStorage(stored.sites).sites;
      const mergedSites = { ...defaultSites, ...localSites };
      delete mergedSites.nettruyen; // Remove old nettruyen config completely
      await chrome.storage.local.set({ sites: mergedSites });
      console.log('Site profiles merged and updated (nettruyen removed).');
    }
  } catch (error) {
    console.error('Failed to initialize sites configuration:', error);
    logBackgroundError('initialize_sites', error);
  }
}

// Initialize default site profiles from sites.json
chrome.runtime.onInstalled.addListener(async () => {
  await initializeSites();

  // Set default repo if not set
  try {
    const data = await chrome.storage.local.get('githubRepo');
    if (!data.githubRepo) {
      await chrome.storage.local.set({ githubRepo: 'seaflower205/manga-downloader' });
    }
  } catch (error) {
    logBackgroundError('initialize_github_repo', error);
  }
});

// Run immediately on service worker startup
initializeSites();

// Fetch latest sites.json from GitHub
async function updateSitesFromGithub() {
  try {
    const data = await chrome.storage.local.get('githubRepo');
    const repo = Security.isSafeGithubRepo(data.githubRepo) ? data.githubRepo : 'seaflower205/manga-downloader';
    const url = `https://raw.githubusercontent.com/${repo}/main/config/sites.json`;
    
    console.log(`Syncing sites configuration from: ${url}`);
    const response = await fetch(url + '?nocache=' + Date.now()); // Prevent caching
    if (!response.ok) throw new Error(`HTTP ${response.status} when fetching from GitHub`);
    
    const githubResult = sanitizeSitesForStorage(await response.json());
    const githubSites = githubResult.sites;
    const stored = await chrome.storage.local.get('sites');
    const localSites = sanitizeSitesForStorage(stored.sites || {}).sites;
    
    // Merge: github profiles override local ones if they have the same key, but keep custom local-only keys
    const mergedSites = { ...localSites, ...githubSites };
    delete mergedSites.nettruyen; // Force delete nettruyen
    await chrome.storage.local.set({ sites: mergedSites, lastSync: Date.now() });
    console.log('Successfully synced sites configuration from GitHub.');
    
    // Notify popup if it is open
    chrome.runtime.sendMessage({ type: 'SYNC_COMPLETED', success: true, count: Object.keys(githubSites).length, skipped: githubResult.skipped.length }).catch(() => {});
    return { success: true, count: Object.keys(githubSites).length, skipped: githubResult.skipped.length };
  } catch (error) {
    console.error('Failed to sync from GitHub:', error);
    logBackgroundError('github_sync', error);
    chrome.runtime.sendMessage({ type: 'SYNC_COMPLETED', success: false, error: error.message }).catch(() => {});
    return { success: false, error: error.message };
  }
}

// Periodic alarm listener removed for security (manual sync only)

// Helper to convert ArrayBuffer to Base64 safely (chunk-based for large buffers)
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

// Bypasses referer restrictions and fetches the image as ArrayBuffer
async function fetchImageWithReferer({ url, referer, index }) {
  const urlObj = new URL(url);
  const ruleId = getNextDnrRuleId(); // Unique rule ID per image fetch task

  if (referer) {
    const rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: referer },
          { header: 'Origin', operation: 'set', value: new URL(referer).origin },
          { header: 'User-Agent', operation: 'set', value: navigator.userAgent }
        ]
      },
      condition: {
        regexFilter: `^${escapeDnrRegex(urlObj.origin + urlObj.pathname)}`,
        resourceTypes: ['xmlhttprequest']
      }
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [ruleId],
      addRules: [rule]
    });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    assertSafeImageResponse(response);
    const buffer = await response.arrayBuffer();
    assertSafeImageResponse(response, buffer);
    return buffer;
  } finally {
    if (referer) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId]
      });
    }
  }
}

function validateFetchGroupPayload(data) {
  if (!data || typeof data !== 'object') return { urls: [], referer: '' };
  const urls = Security.normalizeUrlArray(data.urls, { max: 50 });
  const referer = Security.normalizeUrl(data.referer || '', { allowHttp: true });
  return { urls, referer };
}

function validateZipPayload(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.images)) {
    return { valid: false, images: [], title: 'Manga', chapter: 'Chapter', error: 'Invalid ZIP payload.' };
  }

  const images = [];
  let totalDataLength = 0;
  data.images.slice(0, Security.DEFAULT_LIMITS.zipImages).forEach(img => {
    if (!img || typeof img !== 'object') return;
    const filename = Security.toSafeString(img.filename, 100);
    const dataUrl = typeof img.dataUrl === 'string' ? img.dataUrl : '';
    totalDataLength += dataUrl.length;
    if (
      totalDataLength <= Security.DEFAULT_LIMITS.totalZipDataUrl &&
      Security.isSafeZipEntryName(filename) &&
      Security.isSafeImageDataUrl(dataUrl)
    ) {
      images.push({ filename, dataUrl });
    }
  });

  return {
    valid: images.length > 0,
    images,
    title: Security.safeFilename(data.title, 'Manga'),
    chapter: Security.safeFilename(data.chapter, 'Chapter'),
    error: images.length > 0 ? '' : 'No valid images to package.'
  };
}

function normalizeSearchResults(results) {
  const output = [];
  const seen = new Set();
  results.forEach(item => {
    if (output.length >= Security.DEFAULT_LIMITS.searchResults) return;
    const normalized = Security.normalizeSearchResult(item);
    if (!normalized || seen.has(normalized.url)) return;
    seen.add(normalized.url);
    output.push(normalized);
  });
  return output;
}

function normalizeTrustedHttpUrl(value, allowedHosts, baseUrl = '') {
  const normalized = Security.normalizeUrl(value, {
    baseUrl,
    allowHttp: true,
    allowProtocolRelative: true
  });
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const trusted = allowedHosts.some(host => {
      const allowed = Security.toSafeString(host, 120).toLowerCase();
      return hostname === allowed || hostname.endsWith(`.${allowed}`);
    });
    return trusted ? parsed.href : '';
  } catch (error) {
    return '';
  }
}

function isSafeMangaDexId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(Security.toSafeString(value, 80));
}

function isSafeRemoteFilename(value) {
  return /^[0-9A-Za-z._-]{1,180}$/.test(Security.toSafeString(value, 200));
}

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Security: Only handle messages originating from this extension's own context/scripts
  if (sender.id !== chrome.runtime.id) {
    console.warn('Manga Downloader: Blocked message from external sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender.' });
    return false;
  }

  // 1. Fetch group of images and convert them to data URLs
  if (message.type === 'FETCH_GROUP_DATA') {
    const { urls, referer } = validateFetchGroupPayload(message.data);
    if (urls.length === 0) {
      sendResponse([{ success: false, error: 'Invalid image URLs.' }]);
      return false;
    }
    
    const fetchPromises = urls.map(async (url, idx) => {
      try {
        const buffer = await fetchImageWithReferer({ url, referer, index: idx });
        const bytes = new Uint8Array(buffer);
        
        // Detect content type from magic numbers or default to image/jpeg
        let contentType = 'image/jpeg';
        if (bytes.length > 4) {
          if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            contentType = 'image/png';
          } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
            contentType = 'image/webp';
          } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
            contentType = 'image/gif';
          }
        }
        
        const base64 = arrayBufferToBase64(buffer);
        return {
          url,
          success: true,
          dataUrl: `data:${contentType};base64,${base64}`
        };
      } catch (err) {
        console.error(`Failed fetching image ${url}:`, err);
        logBackgroundError('fetch_image', err, { url: Security.sanitizeUrlForReport(url), index: idx });
        return { url, success: false, error: err.message };
      }
    });

    Promise.all(fetchPromises).then(results => {
      sendResponse(results);
    });

    return true; // Keep message channel open for async response
  }

  // 2. Build ZIP from pre-merged data URLs and trigger download
  if (message.type === 'SAVE_ZIP_DOWNLOAD') {
    const payload = validateZipPayload(message.data);
    if (!payload.valid) {
      Security.logDiagnostic({ feature: 'save_zip_validation', error: payload.error }).catch(() => {});
      sendResponse({ success: false, error: payload.error });
      return false;
    }

    const { images, title, chapter } = payload;
    const zip = new JSZip();

    images.forEach(img => {
      // Decode base64 dataUrl
      const base64Data = img.dataUrl.split(',')[1];
      // Convert base64 back to binary data for JSZip
      zip.file(img.filename, base64Data, { base64: true });
    });

    // Generate ZIP and trigger Chrome download
    zip.generateAsync({ type: 'blob' }).then(async (zipBlob) => {
      const buffer = await zipBlob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const dataUrl = `data:application/zip;base64,${base64}`;

      const safeTitle = Security.safeFilename(title, 'Manga');
      const safeChapter = Security.safeFilename(chapter, 'Chapter');

      await chrome.downloads.download({
        url: dataUrl,
        filename: `${safeTitle} - ${safeChapter}.zip`,
        conflictAction: 'uniquify',
        saveAs: false
      });

      sendResponse({ success: true });
    }).catch(err => {
      console.error('Error generating zip:', err);
      logBackgroundError('save_zip_download', err, { imageCount: images.length });
      sendResponse({ success: false, error: err.message });
    });

    return true;
  }

  // 3. Trigger manual GitHub sync
  if (message.type === 'TRIGGER_GITHUB_SYNC') {
    updateSitesFromGithub().then(res => {
      sendResponse(res);
    });
    return true;
  }

  // 4. Ping site to check if it is active (online)
  if (message.type === 'PING_SITE') {
    const url = Security.normalizeUrl(message.data && message.data.url, { allowHttp: true });
    if (!url) {
      sendResponse({ online: false });
      return false;
    }
    const checkStatus = async () => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok || response.status < 500;
      } catch (err) {
        try {
          const response = await fetch(url, { method: 'GET' });
          return response.ok || response.status < 500;
        } catch (e) {
          return false;
        }
      }
    };

    checkStatus().then(online => {
      sendResponse({ online });
    });
    return true; // Keep channel open for async response
  }

  // 5. Search manga across registered websites
  if (message.type === 'SEARCH_MANGA') {
    const query = Security.toSafeString(message.data && message.data.query, 100);
    if (!query) {
      sendResponse({ success: true, results: [] });
      return false;
    }
    searchManga(query).then(results => {
      sendResponse({ success: true, results: normalizeSearchResults(results) });
    }).catch(err => {
      logBackgroundError('search_manga', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }
});

// Helper function to search manga across websites in the background
async function searchManga(query) {
  const results = [];
  
  // 1. Search on MangaBall
  try {
    // Fetch homepage to get CSRF token and session cookies
    const homeRes = await fetch('https://mangaball.net/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await homeRes.text();
    const csrfMatch = html.match(/csrf-token["']\s*content=["']([^"']+)["']/i);
    const cookies = homeRes.headers.get('set-cookie');
    const cookieHeader = cookies ? cookies.split(',').map(c => c.split(';')[0].trim()).join('; ') : '';
    
    if (csrfMatch) {
      const csrfToken = csrfMatch[1];
      const searchRes = await fetch('https://mangaball.net/api/v1/smart-search/search/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-CSRF-TOKEN': csrfToken,
          'Cookie': cookieHeader
        },
        body: 'search_input=' + encodeURIComponent(query)
      });
      const searchJson = await searchRes.json();
      if (searchJson && searchJson.code === 200 && searchJson.data && searchJson.data.manga) {
        searchJson.data.manga.forEach(m => {
          const rawTitle = Security.toSafeString(m.title, 200);
          const thumbnail = normalizeTrustedHttpUrl(m.img, ['mangaball.net'], 'https://mangaball.net/');
          const url = normalizeTrustedHttpUrl(m.url, ['mangaball.net'], 'https://mangaball.net/');
          if (!url) return;
          results.push({
            title: rawTitle.split('(')[0].trim(), // Clean alternative titles
            author: m.displayAuthor || 'Nhiều tác giả',
            thumbnail,
            url,
            source: 'MangaBall',
            sourceKey: 'mangaball'
          });
        });
      }
    }
  } catch (err) {
    console.error('Error searching MangaBall:', err);
    logBackgroundError('search_mangaball', err);
  }

  // 2. Search on Naver Webtoon
  try {
    const naverRes = await fetch('https://comic.naver.com/api/search/all?keyword=' + encodeURIComponent(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://comic.naver.com/'
      }
    });
    const naverJson = await naverRes.json();
    
    const parseNaverList = (list) => {
      if (!list) return;
      list.forEach(item => {
        const titleId = Security.toSafeString(item.titleId, 40).replace(/[^\d]/g, '');
        if (!titleId) return;
        let listUrl = 'https://comic.naver.com/webtoon/list?titleId=' + encodeURIComponent(titleId);
        if (item.webtoonLevelCode === 'BEST_CHALLENGE') {
          listUrl = 'https://comic.naver.com/bestChallenge/list?titleId=' + encodeURIComponent(titleId);
        } else if (item.webtoonLevelCode === 'CHALLENGE') {
          listUrl = 'https://comic.naver.com/challenge/list?titleId=' + encodeURIComponent(titleId);
        }
        results.push({
          title: item.titleName,
          author: item.displayAuthor || 'Nhiều tác giả',
          thumbnail: normalizeTrustedHttpUrl(item.thumbnailUrl, ['naver.com', 'pstatic.net']),
          url: listUrl,
          source: 'Naver Webtoon',
          sourceKey: 'naverwebtoon'
        });
      });
    };
    
    if (naverJson) {
      if (naverJson.searchWebtoonResult && naverJson.searchWebtoonResult.searchViewList) {
        parseNaverList(naverJson.searchWebtoonResult.searchViewList);
      }
      if (naverJson.searchBestChallengeResult && naverJson.searchBestChallengeResult.searchViewList) {
        parseNaverList(naverJson.searchBestChallengeResult.searchViewList);
      }
      if (naverJson.searchChallengeResult && naverJson.searchChallengeResult.searchViewList) {
        parseNaverList(naverJson.searchChallengeResult.searchViewList);
      }
    }
  } catch (err) {
    console.error('Error searching Naver Webtoon:', err);
    logBackgroundError('search_naverwebtoon', err);
  }
  
  // 3. Search on MangaDex
  try {
    const dexRes = await fetch('https://api.mangadex.org/manga?title=' + encodeURIComponent(query) + '&limit=10&includes[]=cover_art', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const dexJson = await dexRes.json();
    if (dexJson && dexJson.data) {
      dexJson.data.forEach(m => {
        if (!isSafeMangaDexId(m.id)) return;
        const titleMap = m.attributes && m.attributes.title ? m.attributes.title : {};
        const title = titleMap.en || titleMap.ja || titleMap['ja-ro'] || Object.values(titleMap)[0] || 'MangaDex Title';
        
        // Find cover filename
        const coverRel = Array.isArray(m.relationships) ? m.relationships.find(r => r.type === 'cover_art') : null;
        const coverFile = coverRel && coverRel.attributes ? coverRel.attributes.fileName : '';
        const thumbnail = isSafeRemoteFilename(coverFile) ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg` : 'https://mangadex.org/avatar.png';
        
        results.push({
          title: title.trim(),
          author: 'Nhiều tác giả',
          thumbnail,
          url: `https://mangadex.org/title/${m.id}`,
          source: 'MangaDex',
          sourceKey: 'mangadex'
        });
      });
    }
  } catch (err) {
    console.error('Error searching MangaDex:', err);
    logBackgroundError('search_mangadex', err);
  }
  
  // 4. Search on MangaPlaza
  try {
    const plazaRes = await fetch('https://mangaplaza.com/searchresult/?fre=' + encodeURIComponent(query), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await plazaRes.text();
    const listIndex = html.indexOf('class="listBox"');
    if (listIndex !== -1) {
      const listHtml = html.substring(listIndex);
      const liRegex = /<li>([\s\S]*?)<\/li>/gi;
      let match;
      while ((match = liRegex.exec(listHtml)) !== null && results.length < 40) {
        const liContent = match[1];
        
        const titleMatch = liContent.match(/class="titleName"[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!titleMatch) continue;
        const href = titleMatch[1];
        const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
        const url = normalizeTrustedHttpUrl(href, ['mangaplaza.com'], 'https://mangaplaza.com/');
        if (!url) continue;
        
        const imgMatch = liContent.match(/class="thumBlock"[\s\S]*?<img src="([^"]+)"/i);
        const thumbnail = imgMatch ? normalizeTrustedHttpUrl(imgMatch[1], ['mangaplaza.com'], 'https://mangaplaza.com/') : '';
        
        const authorMatch = liContent.match(/class="authorName"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
        const author = authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : 'Nhiều tác giả';
        
        results.push({
          title,
          author,
          thumbnail,
          url,
          source: 'MangaPlaza',
          sourceKey: 'mangaplaza'
        });
      }
    }
  } catch (err) {
    console.error('Error searching MangaPlaza:', err);
    logBackgroundError('search_mangaplaza', err);
  }
  
  return results;
}
