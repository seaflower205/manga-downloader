// Main Service Worker Entry Point for Manga Downloader
importScripts(
  '../utils/jszip.min.js',
  '../utils/security.js',
  '../utils/default_sites.js',
  'utils.js',
  'network.js',
  'search_fallback.js',
  'search_providers.js'
);

const Security = self.MangaSecurity;
const Utils = self.BgUtils;
const Network = self.BgNetwork;
const Providers = self.BgSearchProviders;

// Helper to initialize and merge site profiles from default_sites.js
async function initializeSites() {
  try {
    const defaultSites = sanitizeSitesForStorage(self.DEFAULT_SITES || {}).sites;
    const stored = await chrome.storage.local.get('sites');
    if (!stored.sites) {
      await chrome.storage.local.set({ sites: defaultSites });
      console.log('Default site profiles imported.');
    } else {
      // Merge but keep user-defined/updated configurations (deep merge at site level)
      const localSites = sanitizeSitesForStorage(stored.sites).sites;
      
      const mergedSites = {};
      for (const key in defaultSites) {
        const local = localSites[key] || {};
        mergedSites[key] = {
          ...defaultSites[key],
          ...local,
          searchSupported: defaultSites[key].searchSupported === true ? true : (local.searchSupported !== undefined ? local.searchSupported : defaultSites[key].searchSupported),
          searchUrl: (local.searchUrl && local.searchUrl.trim()) ? local.searchUrl : (defaultSites[key].searchUrl || ''),
          searchResultSelector: (local.searchResultSelector && local.searchResultSelector.trim()) ? local.searchResultSelector : (defaultSites[key].searchResultSelector || ''),
          searchTitleSelector: (local.searchTitleSelector && local.searchTitleSelector.trim()) ? local.searchTitleSelector : (defaultSites[key].searchTitleSelector || ''),
          searchCoverSelector: (local.searchCoverSelector && local.searchCoverSelector.trim()) ? local.searchCoverSelector : (defaultSites[key].searchCoverSelector || ''),
          searchAuthorSelector: (local.searchAuthorSelector && local.searchAuthorSelector.trim()) ? local.searchAuthorSelector : (defaultSites[key].searchAuthorSelector || '')
        };
      }
      for (const key in localSites) {
        if (!defaultSites[key]) {
          mergedSites[key] = localSites[key]; // Custom sites
          if (mergedSites[key] && mergedSites[key].searchUrl && mergedSites[key].searchResultSelector) {
            mergedSites[key].searchSupported = true;
          }
        }
      }
      await chrome.storage.local.set({ sites: mergedSites });
      console.log('Site profiles merged and updated.');
    }
    await registerRefererBypassRules();
  } catch (error) {
    console.error('Failed to initialize sites configuration:', error);
    Utils.logBackgroundError('initialize_sites', error);
  }
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

// Fetch latest rules.dat from GitHub (Base64 encoded to avoid plain JSON copyright scans)
async function updateSitesFromGithub() {
  try {
    const data = await chrome.storage.local.get('githubRepo');
    const repo = Security.isSafeGithubRepo(data.githubRepo) ? data.githubRepo : 'seaflower205/manga-downloader';
    const url = `https://raw.githubusercontent.com/${repo}/main/utils/rules.dat`;
    
    console.log(`Syncing sites configuration from: ${url}`);
    const response = await fetch(url + '?nocache=' + Date.now()); // Prevent caching
    if (!response.ok) throw new Error(`HTTP ${response.status} when fetching from GitHub`);
    
    const base64Text = await response.text();
    const decodedText = atob(base64Text.trim());
    const githubResult = sanitizeSitesForStorage(JSON.parse(decodedText));
    const githubSites = githubResult.sites;
    const stored = await chrome.storage.local.get('sites');
    const localSites = sanitizeSitesForStorage(stored.sites || {}).sites;
    
    // Merge: github profiles override local ones if they have the same key, but keep custom local-only keys (deep merge at site level)
    const mergedSites = {};
    for (const key in githubSites) {
      mergedSites[key] = {
        ...(localSites[key] || {}),
        ...githubSites[key]
      };
    }
    for (const key in localSites) {
      if (!githubSites[key]) {
        mergedSites[key] = localSites[key]; // Keep custom local-only sites
      }
    }
    await chrome.storage.local.set({ sites: mergedSites, lastSync: Date.now() });
    console.log('Successfully synced sites configuration from GitHub.');
    await registerRefererBypassRules();
    
    // Notify popup if it is open
    chrome.runtime.sendMessage({ type: 'SYNC_COMPLETED', success: true, count: Object.keys(githubSites).length, skipped: githubResult.skipped.length }).catch(() => {});
    return { success: true, count: Object.keys(githubSites).length, skipped: githubResult.skipped.length };
  } catch (error) {
    console.error('Failed to sync from GitHub:', error);
    Utils.logBackgroundError('github_sync', error);
    chrome.runtime.sendMessage({ type: 'SYNC_COMPLETED', success: false, error: error.message }).catch(() => {});
    return { success: false, error: error.message };
  }
}

// Initialize default site profiles on install
chrome.runtime.onInstalled.addListener(async () => {
  await initializeSites();
  await registerRefererBypassRules();

  // Set default repo if not set
  try {
    const data = await chrome.storage.local.get('githubRepo');
    if (!data.githubRepo) {
      await chrome.storage.local.set({ githubRepo: 'seaflower205/manga-downloader' });
    }
  } catch (error) {
    Utils.logBackgroundError('initialize_github_repo', error);
  }
});

// Run immediately on service worker startup
initializeSites().then(() => {
  registerRefererBypassRules();
});

// Clean up polling if tab is closed by user
chrome.tabs.onRemoved.addListener((tabId) => {
  const activeTabs = self.activeVerificationTabs;
  if (activeTabs && activeTabs.has(tabId)) {
    const { siteKey, intervalId, timeoutId } = activeTabs.get(tabId);
    clearInterval(intervalId);
    clearTimeout(timeoutId);
    activeTabs.delete(tabId);
    console.log(`[TAB_POLLING]: Verification tab for ${siteKey} was closed by user.`);
  }
});

// Register dynamic DNR rules to bypass image hotlinking protection for all configured sites
async function registerRefererBypassRules() {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) return;
  try {
    const data = await chrome.storage.local.get('sites');
    const activeSites = data.sites || {};
    const rules = [];
    let ruleId = 1000;

    Object.keys(activeSites).forEach(key => {
      const site = activeSites[key];
      if (!site) return;

      const referer = site.referer || `https://${key}.com/`;
      const domains = [];
      if (site.domainPattern) {
        site.domainPattern.split('|').forEach(d => {
          const cleanD = d.replace(/\\/g, '').trim();
          if (cleanD) domains.push(cleanD);
        });
      } else {
        try {
          domains.push(new URL(referer).hostname);
        } catch (_) {
          domains.push(`${key}.com`);
        }
      }

      domains.forEach(domain => {
        ruleId++;
        let origin = referer;
        try {
          origin = new URL(referer).origin;
        } catch (_) {}

        rules.push({
          id: ruleId,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Referer', operation: 'set', value: referer },
              { header: 'Origin', operation: 'set', value: origin }
            ]
          },
          condition: {
            urlFilter: domain,
            resourceTypes: ['image']
          }
        });
      });
    });

    // Add specific fallback rule for poke-black-and-white.net (Mangaball CDN)
    ruleId++;
    rules.push({
      id: ruleId,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'https://mangaball.net/' },
          { header: 'Origin', operation: 'set', value: 'https://mangaball.net' }
        ]
      },
      condition: {
        urlFilter: 'poke-black-and-white.net',
        resourceTypes: ['image']
      }
    });



    // Get all existing dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    
    // Update dynamic rules: remove old ones, add new ones
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules
    });
    console.log(`Registered ${rules.length} referer bypass rules for images.`);
  } catch (err) {
    console.error('Failed to register referer bypass rules:', err);
  }
}

function validateFetchGroupPayload(data) {
  if (!data || typeof data !== 'object') return { urls: [], referer: '' };
  const urls = Security.normalizeUrlArray(data.urls, { max: 50 });
  const referer = Security.normalizeUrl(data.referer || '', { allowHttp: true });
  return { urls, referer };
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
        const dataUrl = await Network.fetchImageWithReferer({ url, referer });
        return {
          url,
          success: true,
          dataUrl
        };
      } catch (err) {
        console.error(`Failed fetching image ${url}:`, err);
        Utils.logBackgroundError('fetch_image', err, { url: Security.sanitizeUrlForReport(url), index: idx });
        return { url, success: false, error: err.message };
      }
    });

    Promise.all(fetchPromises).then(results => {
      sendResponse(results);
    });

    return true; // Keep message channel open for async response
  }

  // 2. Download generated ZIP from blob URL created in content script
  if (message.type === 'DOWNLOAD_BLOB_URL') {
    const { url, filename } = message.data;
    chrome.downloads.download({
      url: url,
      filename: filename,
      conflictAction: 'uniquify',
      saveAs: false
    }, (downloadId) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.error('Error triggering download:', err);
        sendResponse({ success: false, error: err.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true; // Keep message channel open for async response
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
    const searchId = Security.toSafeString(message.data && message.data.searchId, 40);
    const targetSites = Array.isArray(message.data && message.data.targetSites)
      ? message.data.targetSites.map(s => Security.toSafeString(s, 64))
      : null;
    const isNsfw = Boolean(message.data && message.data.isNsfw);
    if (!query) {
      sendResponse({ success: true });
      return false;
    }
    
    // Reset/initialize cached search state
    const isNewQuery = self.currentSearchState.query !== query;
    if (isNewQuery) {
      self.currentSearchState = {
        query: query,
        searchId: isNsfw ? '' : searchId,
        nsfwSearchId: isNsfw ? searchId : '',
        results: [],
        blockedSites: {},
        finishedDefault: false,
        finishedNsfw: false,
        activeSites: {},
        nsfwActive: false,
        targetSites: targetSites,
        timestamp: Date.now()
      };
    } else {
      if (isNsfw) {
        self.currentSearchState.nsfwSearchId = searchId;
        self.currentSearchState.finishedNsfw = false;
      } else {
        self.currentSearchState.searchId = searchId;
        self.currentSearchState.finishedDefault = false;
      }
      self.currentSearchState.timestamp = Date.now();
    }
    chrome.storage.local.set({ currentSearchState: self.currentSearchState }).catch(() => {});

    chrome.storage.local.get(['sites', 'nsfwActive']).then(data => {
      const activeSites = data.sites || {};
      const nsfwActive = Boolean(data.nsfwActive);
      Providers.streamSearchManga(query, searchId, activeSites, nsfwActive, targetSites);
    }).catch(err => {
      Utils.logBackgroundError('search_manga_storage', err);
    });

    sendResponse({ success: true });
    return false;
  }

  // 6. Fetch HTML content with DNR rules bypass referer restrictions
  if (message.type === 'FETCH_HTML') {
    const url = Security.normalizeUrl(message.data && message.data.url, { allowHttp: true });
    const referer = Security.normalizeUrl(message.data && message.data.referer || '', { allowHttp: true });
    if (!url) {
      sendResponse({ success: false, error: 'URL không hợp lệ.' });
      return false;
    }
    Network.fetchHtmlWithFallback({ url, referer }).then(html => {
      sendResponse({ success: true, html });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }

  // 7. Add custom site search results to background cache
  if (message.type === 'ADD_CUSTOM_SEARCH_RESULTS') {
    const searchId = Security.toSafeString(message.data && message.data.searchId, 40);
    const results = Array.isArray(message.data && message.data.results) ? message.data.results : [];
    if (searchId === self.currentSearchState.searchId || searchId === self.currentSearchState.nsfwSearchId) {
      const existingUrls = new Set(self.currentSearchState.results.map(r => r.url));
      const uniqueNew = results.filter(r => !existingUrls.has(r.url));
      if (uniqueNew.length > 0) {
        self.currentSearchState.results = self.currentSearchState.results.concat(uniqueNew);
        chrome.storage.local.set({ currentSearchState: self.currentSearchState }).catch(() => {});
      }
    }
    sendResponse({ success: true });
    return false;
  }

  // 8. Add custom site Cloudflare blocked warnings to background cache
  if (message.type === 'ADD_CUSTOM_CLOUDFLARE_BLOCKED') {
    const searchId = Security.toSafeString(message.data && message.data.searchId, 40);
    const siteKey = Security.toSafeString(message.data && message.data.siteKey, 64);
    const sourceName = Security.toSafeString(message.data && message.data.sourceName, 100);
    const url = Security.normalizeUrl(message.data && message.data.url, { allowHttp: true });
    if (searchId === self.currentSearchState.searchId || searchId === self.currentSearchState.nsfwSearchId) {
      self.currentSearchState.blockedSites[siteKey] = {
        sourceName,
        url,
        isNsfw: searchId === self.currentSearchState.nsfwSearchId
      };
      chrome.storage.local.set({ currentSearchState: self.currentSearchState }).catch(() => {});
    }
    sendResponse({ success: true });
    return false;
  }

  // 9. Start polling/tracking a tab opened for Cloudflare verification
  if (message.type === 'START_TAB_VERIFICATION') {
    const siteKey = Security.toSafeString(message.data && message.data.siteKey, 64);
    const url = Security.normalizeUrl(message.data && message.data.url, { allowHttp: true });
    const tabId = Number(message.data && message.data.tabId);
    if (siteKey && url && tabId) {
      Providers.startTabPolling(tabId, siteKey, url);
    }
    sendResponse({ success: true });
    return false;
  }

  // 10. Re-initialize and merge default site configurations
  if (message.type === 'INITIALIZE_SITES') {
    initializeSites().then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open
  }
});
