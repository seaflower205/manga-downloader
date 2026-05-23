// Background Service Worker for Manga Downloader Premium
importScripts('../utils/jszip.min.js');

// Initialize default site profiles from sites.json
chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Clear any existing alarms for security
    await chrome.alarms.clearAll();
    console.log('Periodic alarms cleared for security.');

    const response = await fetch(chrome.runtime.getURL('config/sites.json'));
    const sites = await response.json();
    const stored = await chrome.storage.local.get('sites');
    if (!stored.sites) {
      await chrome.storage.local.set({ sites });
      console.log('Default site profiles imported.');
    } else {
      // Merge but keep user-defined/updated configurations
      const mergedSites = { ...sites, ...stored.sites };
      delete mergedSites.nettruyen; // Remove old nettruyen config completely
      await chrome.storage.local.set({ sites: mergedSites });
      console.log('Site profiles merged and updated (nettruyen removed).');
    }

    // Set default repo if not set
    const data = await chrome.storage.local.get('githubRepo');
    if (!data.githubRepo) {
      await chrome.storage.local.set({ githubRepo: 'seaflower205/manga-downloader' });
    }

  } catch (error) {
    console.error('Failed to initialize sites configuration:', error);
  }
});

// Fetch latest sites.json from GitHub
async function updateSitesFromGithub() {
  try {
    const data = await chrome.storage.local.get('githubRepo');
    const repo = data.githubRepo || 'seaflower205/manga-downloader';
    const url = `https://raw.githubusercontent.com/${repo}/main/config/sites.json`;
    
    console.log(`Syncing sites configuration from: ${url}`);
    const response = await fetch(url + '?nocache=' + Date.now()); // Prevent caching
    if (!response.ok) throw new Error(`HTTP ${response.status} when fetching from GitHub`);
    
    const githubSites = await response.json();
    const stored = await chrome.storage.local.get('sites');
    const localSites = stored.sites || {};
    
    // Merge: github profiles override local ones if they have the same key, but keep custom local-only keys
    const mergedSites = { ...localSites, ...githubSites };
    delete mergedSites.nettruyen; // Force delete nettruyen
    await chrome.storage.local.set({ sites: mergedSites, lastSync: Date.now() });
    console.log('Successfully synced sites configuration from GitHub.');
    
    // Notify popup if it is open
    chrome.runtime.sendMessage({ type: 'SYNC_COMPLETED', success: true, count: Object.keys(githubSites).length }).catch(() => {});
    return { success: true, count: Object.keys(githubSites).length };
  } catch (error) {
    console.error('Failed to sync from GitHub:', error);
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
  const ruleId = index + 2000; // Unique rule ID per image fetch task

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
        urlFilter: urlObj.hostname + urlObj.pathname,
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
    return await response.arrayBuffer();
  } finally {
    if (referer) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId]
      });
    }
  }
}

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Fetch group of images and convert them to data URLs
  if (message.type === 'FETCH_GROUP_DATA') {
    const { urls, referer } = message.data;
    
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
    const { images, title, chapter } = message.data;
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

      const safeTitle = title.replace(/[\\\\/:*?\"<>|]/g, '').trim();
      const safeChapter = chapter.replace(/[\\\\/:*?\"<>|]/g, '').trim();

      await chrome.downloads.download({
        url: dataUrl,
        filename: `${safeTitle} - ${safeChapter}.zip`,
        conflictAction: 'overwrite',
        saveAs: false
      });

      sendResponse({ success: true });
    }).catch(err => {
      console.error('Error generating zip:', err);
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
    const { url } = message.data;
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
    const { query } = message.data;
    searchManga(query).then(results => {
      sendResponse({ success: true, results });
    }).catch(err => {
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
          results.push({
            title: m.title.split('(')[0].trim(), // Clean alternative titles
            author: m.displayAuthor || 'Nhiều tác giả',
            thumbnail: m.img.startsWith('http') ? m.img : 'https://mangaball.net' + m.img,
            url: m.url.startsWith('http') ? m.url : 'https://mangaball.net' + m.url,
            source: 'MangaBall',
            sourceKey: 'mangaball'
          });
        });
      }
    }
  } catch (err) {
    console.error('Error searching MangaBall:', err);
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
        let listUrl = 'https://comic.naver.com/webtoon/list?titleId=' + item.titleId;
        if (item.webtoonLevelCode === 'BEST_CHALLENGE') {
          listUrl = 'https://comic.naver.com/bestChallenge/list?titleId=' + item.titleId;
        } else if (item.webtoonLevelCode === 'CHALLENGE') {
          listUrl = 'https://comic.naver.com/challenge/list?titleId=' + item.titleId;
        }
        results.push({
          title: item.titleName,
          author: item.displayAuthor || 'Nhiều tác giả',
          thumbnail: item.thumbnailUrl,
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
        const titleMap = m.attributes.title;
        const title = titleMap.en || titleMap.ja || titleMap['ja-ro'] || Object.values(titleMap)[0] || 'MangaDex Title';
        
        // Find cover filename
        const coverRel = m.relationships.find(r => r.type === 'cover_art');
        const coverFile = coverRel && coverRel.attributes ? coverRel.attributes.fileName : '';
        const thumbnail = coverFile ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg` : 'https://mangadex.org/avatar.png';
        
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
        const url = href.startsWith('http') ? href : 'https://mangaplaza.com' + href;
        
        const imgMatch = liContent.match(/class="thumBlock"[\s\S]*?<img src="([^"]+)"/i);
        const thumbnail = imgMatch ? imgMatch[1] : '';
        
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
  }
  
  return results;
}

