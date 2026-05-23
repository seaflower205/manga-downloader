// Background Service Worker for Manga Downloader Premium
importScripts('../utils/jszip.min.js');

// Initialize default site profiles from sites.json
chrome.runtime.onInstalled.addListener(async () => {
  try {
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

    // Set up periodic sync alarm (every 6 hours)
    await chrome.alarms.create('github-sync-alarm', { periodInMinutes: 360 });
    // Run an initial sync on install
    await updateSitesFromGithub();

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

// Alarm listener for periodic update check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'github-sync-alarm') {
    updateSitesFromGithub();
  }
});

// Helper to convert ArrayBuffer to Base64 safely
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
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
});
