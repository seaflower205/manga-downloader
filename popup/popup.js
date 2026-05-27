// Popup Dashboard coordinator for Manga Downloader
document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  const Security = window.MangaSecurity;

  // Apply custom theme immediately to prevent flashing of unstyled content
  if (window.ThemeManager) {
    await window.ThemeManager.applyCustomTheme();
  }

  // Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const sitesContainer = document.getElementById('sites-container');
  const sitesCount = document.getElementById('sites-count');
  
  const configForm = document.getElementById('config-form');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const editKeyInput = document.getElementById('edit-key');
  const jsonConfigInput = document.getElementById('json-config-input');

  const diagnosticCount = document.getElementById('diagnostic-count');

  // State Variables
  let allSites = {};
  let pinnedSites = [];
  let disabledSearchSites = [];
  let logoClickCount = 0;
  let logoClickTimeout = null;
  let nsfwUnlockedBefore = false;
  let nsfwActive = false;

  const ICONS = {
    open: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    delete: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-svg"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    pin: '<svg class="icon-pin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.54l-2.78 3.5a2 2 0 0 0-.44 1.24V17Z"/></svg>',
    pinned: '<svg class="icon-pin pinned" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.54l-2.78 3.5a2 2 0 0 0-.44 1.24V17Z"/></svg>'
  };

  // Helper Utilities
  function clearElement(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function appendText(parent, text, className) {
    const el = document.createElement('span');
    if (className) el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function makeIconButton(className, title, icon) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.title = title;
    btn.innerHTML = icon;
    return btn;
  }

  function showBox(container, text, padding = '20px') {
    clearElement(container);
    const box = document.createElement('div');
    box.style.textAlign = 'center';
    box.style.color = 'var(--text-secondary)';
    box.style.padding = padding;
    box.textContent = text;
    container.appendChild(box);
  }

  function safeOpenUrl(url) {
    const safeUrl = Security.normalizeUrl(url, { allowHttp: true });
    if (!safeUrl) {
      Security.logDiagnostic({ feature: 'open_url_rejected', error: 'Invalid URL' });
      return;
    }
    chrome.tabs.create({ url: safeUrl });
  }

  function getSiteOpenUrl(site) {
    const referer = Security.normalizeUrl(site && site.referer, { allowHttp: true });
    if (referer) return referer;
    const pattern = Security.toSafeString(site && site.domainPattern, 120).split('|')[0];
    const cleanDomain = pattern.replace(/\\\./g, '.').replace(/[^a-zA-Z0-9.-]/g, '');
    if (!cleanDomain) return '';
    return Security.normalizeUrl(`https://${cleanDomain.includes('.') ? cleanDomain : `${cleanDomain}.com`}/`, { allowHttp: true });
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  function validateAndStoreSites(rawSites) {
    const result = Security.sanitizeSiteMap(rawSites);
    if (result.skipped.length > 0) {
      Security.logDiagnostic({
        feature: 'popup_site_validation',
        metadata: { skipped: result.skipped.join(',') }
      });
    }
    return result.sites;
  }

  function makeStatusAlert(type, icon, builder) {
    const alertBox = document.createElement('div');
    alertBox.className = `status-alert ${type}`;
    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = icon;
    const content = document.createElement('div');
    content.className = 'alert-content';
    builder(content);
    alertBox.append(iconWrap.firstElementChild, content);
    return alertBox;
  }

  function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('status-notification-area');
    if (!notificationArea) return;
    clearElement(notificationArea);

    const icon = type === 'success' ? ICONS.success : ICONS.warning;
    const alertBox = makeStatusAlert(type, icon, content => {
      const line = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = type === 'success' ? 'Thành công: ' : type === 'warning' ? 'Cảnh báo: ' : 'Lỗi: ';
      line.append(strong, document.createTextNode(message));
      content.appendChild(line);
    });

    notificationArea.appendChild(alertBox);
    setTimeout(() => {
      if (alertBox.parentNode) {
        alertBox.classList.add('fade-out');
        setTimeout(() => {
          if (alertBox.parentNode) alertBox.remove();
        }, 250);
      }
    }, 5000);
  }


  async function refreshDiagnosticCount() {
    if (!diagnosticCount) return;
    const events = await Security.getDiagnosticEvents();
    diagnosticCount.textContent = events.length;
  }

  // Export diagnostic report utils
  function stringToDataUrl(mime, text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      const chunk = bytes.subarray(i, i + 8192);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return `data:${mime};base64,${btoa(binary)}`;
  }

  async function downloadJson(filename, payload) {
    const json = JSON.stringify(payload, null, 2);
    await chrome.downloads.download({
      url: stringToDataUrl('application/json', json),
      filename,
      conflictAction: 'uniquify',
      saveAs: true
    });
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  // Expose namespaces to other managers globally
  window.MangaPopup = {
    get allSites() { return allSites; },
    get pinnedSites() { return pinnedSites; },
    get disabledSearchSites() { return disabledSearchSites; },
    set disabledSearchSites(val) { disabledSearchSites = val; },
    ICONS,
    clearElement,
    showBox,
    safeOpenUrl,
    makeIconButton,
    showNotification,
    loadSites,
    renderSearchBadges,
    renderNsfwSearchBadges
  };

  // Tab switching handler
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const activeTabId = tab.getAttribute('data-tab');
      const activeTab = document.getElementById(activeTabId);
      if (activeTab) activeTab.classList.add('active');
      if (activeTabId === 'diagnostics-tab') refreshDiagnosticCount();
    });
  });

  // Load and Render Web sites lists
  async function loadSites() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const data = await chrome.storage.local.get(['sites', 'pinnedSites', 'nsfwUnlockedBefore', 'nsfwActive', 'disabledSearchSites']);
    
    pinnedSites = Array.isArray(data.pinnedSites) ? data.pinnedSites : [];
    disabledSearchSites = Array.isArray(data.disabledSearchSites) ? data.disabledSearchSites : [];
    allSites = validateAndStoreSites(data.sites || {});
    nsfwUnlockedBefore = Boolean(data.nsfwUnlockedBefore);
    nsfwActive = Boolean(data.nsfwActive);

    applyNsfwModeUI(nsfwActive);
  }

  function filterAndRenderSites() {
    const searchQuery = document.getElementById('site-search').value.toLowerCase().trim();
    clearElement(sitesContainer);
    
    const nsfwSitesContainer = document.getElementById('nsfw-sites-container');
    if (nsfwSitesContainer) clearElement(nsfwSitesContainer);

    const normalKeys = [];
    const nsfwKeys = [];

    Object.entries(allSites).forEach(([key, site]) => {
      const matchQuery = site.name.toLowerCase().includes(searchQuery) || key.toLowerCase().includes(searchQuery);
      if (!matchQuery) return;

      if (site.isNsfw) {
        nsfwKeys.push(key);
      } else {
        normalKeys.push(key);
      }
    });

    // Sort regular sites (pinned first, then alphabetical)
    normalKeys.sort((a, b) => {
      const pinA = pinnedSites.includes(a);
      const pinB = pinnedSites.includes(b);
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;
      return allSites[a].name.localeCompare(allSites[b].name);
    });

    // Render Normal
    if (normalKeys.length === 0) {
      showBox(sitesContainer, Object.keys(allSites).length === 0 ? 'Chưa có cấu hình trang nào. Hãy thêm ở tab bên cạnh!' : 'Không tìm thấy trang web nào phù hợp!');
    } else {
      normalKeys.forEach(key => renderSiteCard(key, allSites[key], sitesContainer));
    }
    if (sitesCount) sitesCount.textContent = normalKeys.length;

    // Render NSFW
    if (nsfwSitesContainer) {
      nsfwKeys.sort((a, b) => {
        const pinA = pinnedSites.includes(a);
        const pinB = pinnedSites.includes(b);
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;
        return allSites[a].name.localeCompare(allSites[b].name);
      });

      if (nsfwKeys.length === 0) {
        showBox(nsfwSitesContainer, 'Không có trang web 18+ nào.');
      } else {
        nsfwKeys.forEach(key => renderSiteCard(key, allSites[key], nsfwSitesContainer));
      }
      
      const nsfwBadge = document.querySelector('.nsfw-badge');
      if (nsfwBadge) nsfwBadge.textContent = nsfwKeys.length;
    }
  }

  function renderSiteCard(key, site, container = sitesContainer) {
    const card = document.createElement('div');
    card.className = 'site-card';
    
    // Staggered entry animation delay based on index in container
    const childCount = container.children.length;
    card.style.animationDelay = `${childCount * 25}ms`;

    const cardMain = document.createElement('div');
    cardMain.className = 'site-card-main';

    const logoImg = document.createElement('img');
    logoImg.className = 'site-card-logo';
    let domain = 'example.com';
    try {
      const openUrl = getSiteOpenUrl(site);
      if (openUrl) domain = new URL(openUrl).hostname;
    } catch (_) {}
    logoImg.src = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    logoImg.addEventListener('error', () => {
      logoImg.src = chrome.runtime.getURL('icons/icon16.png');
    }, { once: true });

    const info = document.createElement('div');
    info.className = 'site-info';
    const title = document.createElement('h3');
    title.textContent = site.name;
    const pattern = document.createElement('p');
    pattern.appendChild(document.createTextNode('Mẫu miền: '));
    const code = document.createElement('code');
    code.textContent = site.domainPattern;
    pattern.appendChild(code);

    const status = document.createElement('div');
    status.className = 'site-status-container';
    const dot = document.createElement('span');
    dot.className = 'status-dot checking';
    const statusText = document.createElement('span');
    statusText.className = 'status-text';
    statusText.textContent = 'Đang kiểm tra...';
    status.append(dot, statusText);
    info.append(title, pattern, status);

    cardMain.append(logoImg, info);

    const isPinned = pinnedSites.includes(key);
    if (isPinned) card.classList.add('pinned');

    const actions = document.createElement('div');
    actions.className = 'site-actions';

    const pinBtn = makeIconButton(
      `btn-icon pin-btn ${isPinned ? 'pinned' : ''}`,
      isPinned ? 'Bỏ ghim' : 'Ghim lên đầu',
      isPinned ? ICONS.pinned : ICONS.pin
    );
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isPinned) {
        pinnedSites = pinnedSites.filter(k => k !== key);
      } else {
        pinnedSites.push(key);
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ pinnedSites });
      }
      filterAndRenderSites();
    });
    actions.appendChild(pinBtn);

    const openUrl = getSiteOpenUrl(site);
    if (openUrl) {
      const openBtn = makeIconButton('btn-icon open-btn launch-btn', `Mở nhanh: ${openUrl}`, ICONS.open);
      openBtn.addEventListener('click', e => {
        e.stopPropagation();
        safeOpenUrl(openUrl);
      });
      actions.appendChild(openBtn);
    }

    const editBtn = makeIconButton('btn-icon edit-btn', 'Sửa', ICONS.edit);
    editBtn.addEventListener('click', () => editSite(key, site));
    const deleteBtn = makeIconButton('btn-icon delete delete-btn', 'Xóa', ICONS.delete);
    deleteBtn.addEventListener('click', () => deleteSite(key));
    actions.append(editBtn, deleteBtn);

    card.append(cardMain, actions);
    container.appendChild(card);

    if (openUrl) {
      chrome.runtime.sendMessage({ type: 'PING_SITE', data: { url: openUrl } }, response => {
        dot.classList.remove('checking');
        if (response && response.online) {
          dot.classList.add('active');
          statusText.textContent = 'Hoạt động';
          statusText.style.color = '#10b981';
        } else {
          dot.classList.add('inactive');
          statusText.textContent = 'Không hoạt động';
          statusText.style.color = '#ef4444';
        }
      });
    } else {
      dot.classList.remove('checking');
      dot.classList.add('inactive');
      statusText.textContent = 'Không có URL';
    }
  }

  function applyNsfwModeUI(active) {
    nsfwActive = active;
    const logoImg = document.querySelector('.app-logo-img');
    const headerH1 = document.querySelector('.logo-area h1');
    const nsfwTabs = document.querySelectorAll('.nsfw-only-tab');
    const nsfwFields = document.querySelectorAll('.nsfw-only-field');

    if (active) {
      document.body.classList.add('nsfw-mode-active');
      if (logoImg) logoImg.src = '../icons/hentai_icon48.png';
      if (headerH1) headerH1.textContent = 'Hentai Downloader';
      nsfwTabs.forEach(tab => tab.style.display = 'flex');
      nsfwFields.forEach(f => f.style.display = 'flex');
    } else {
      document.body.classList.remove('nsfw-mode-active');
      if (logoImg) logoImg.src = '../icons/icon48.png';
      if (headerH1) headerH1.textContent = 'Manga Downloader';
      nsfwTabs.forEach(tab => tab.style.display = 'none');
      nsfwFields.forEach(f => f.style.display = 'none');
      
      const activeTabButton = document.querySelector('.tab-btn.active');
      if (activeTabButton) {
        const tabAttr = activeTabButton.getAttribute('data-tab');
        if (tabAttr === 'nsfw-list' || tabAttr === 'search-nsfw-tab') {
          const defaultTab = document.querySelector('.tab-btn[data-tab="sites-list"]');
          if (defaultTab) defaultTab.click();
        }
      }
    }
    
    // Auto-update theme when toggling modes
    if (window.ThemeManager) {
      window.ThemeManager.applyCustomTheme();
    }
    
    filterAndRenderSites();
    renderSearchBadges();
    renderNsfwSearchBadges();
  }

  function renderSearchBadges() {
    const container = document.querySelector('.search-supported-sources-container');
    if (!container) return;
    clearElement(container);
    
    Object.entries(allSites).forEach(([key, site]) => {
      if (site.isNsfw) return;

      const isSearchable = Boolean(site.searchSupported) || Boolean(site.searchUrl && site.searchResultSelector);
      if (isSearchable) {
        const badge = document.createElement('span');
        badge.className = `search-source-badge sm-${key}`;
        if (disabledSearchSites.includes(key)) badge.classList.add('deselected');
        badge.textContent = site.name;
        
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
        const hue = Math.abs(hash % 360);
        
        // Dynamically compute lightness & opacity based on theme to maintain readability
        const isLightTheme = document.body.classList.contains('light-theme');
        const lightnessText = isLightTheme ? '38%' : '82%';
        const lightnessBg = isLightTheme ? '96%' : '55%';
        const alphaBg = isLightTheme ? '0.7' : '0.08';
        const lightnessBorder = isLightTheme ? '75%' : '55%';
        const alphaBorder = isLightTheme ? '0.4' : '0.3';
        
        badge.style.color = `hsl(${hue}, 85%, ${lightnessText})`;
        badge.style.borderColor = `hsla(${hue}, 70%, ${lightnessBorder}, ${alphaBorder})`;
        badge.style.background = `hsla(${hue}, 70%, ${lightnessBg}, ${alphaBg})`;
        
        badge.addEventListener('click', async () => {
          if (disabledSearchSites.includes(key)) {
            disabledSearchSites = disabledSearchSites.filter(k => k !== key);
            badge.classList.remove('deselected');
          } else {
            disabledSearchSites.push(key);
            badge.classList.add('deselected');
          }
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ disabledSearchSites });
          }
          if (window.SearchManager) window.SearchManager.updateSearchResultsVisibility('manga-search-results');
        });
        container.appendChild(badge);
      }
    });
  }

  function renderNsfwSearchBadges() {
    const container = document.querySelector('.search-supported-nsfw-sources-container');
    if (!container) return;
    clearElement(container);
    
    Object.entries(allSites).forEach(([key, site]) => {
      if (!site.isNsfw) return;

      const isSearchable = Boolean(site.searchSupported) || Boolean(site.searchUrl && site.searchResultSelector);
      if (isSearchable) {
        const badge = document.createElement('span');
        badge.className = `search-source-badge sm-${key}`;
        if (disabledSearchSites.includes(key)) badge.classList.add('deselected');
        badge.textContent = site.name;
        
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
        const hue = Math.abs(hash % 360);
        
        // Dynamically compute lightness & opacity based on theme to maintain readability
        const isLightTheme = document.body.classList.contains('light-theme');
        const lightnessText = isLightTheme ? '38%' : '82%';
        const lightnessBg = isLightTheme ? '96%' : '55%';
        const alphaBg = isLightTheme ? '0.7' : '0.08';
        const lightnessBorder = isLightTheme ? '75%' : '55%';
        const alphaBorder = isLightTheme ? '0.4' : '0.3';
        
        badge.style.color = `hsl(${hue}, 85%, ${lightnessText})`;
        badge.style.borderColor = `hsla(${hue}, 70%, ${lightnessBorder}, ${alphaBorder})`;
        badge.style.background = `hsla(${hue}, 70%, ${lightnessBg}, ${alphaBg})`;
        
        badge.addEventListener('click', async () => {
          if (disabledSearchSites.includes(key)) {
            disabledSearchSites = disabledSearchSites.filter(k => k !== key);
            badge.classList.remove('deselected');
          } else {
            disabledSearchSites.push(key);
            badge.classList.add('deselected');
          }
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ disabledSearchSites });
          }
          if (window.SearchManager) window.SearchManager.updateSearchResultsVisibility('nsfw-search-results');
        });
        container.appendChild(badge);
      }
    });
  }

  // Search input event listeners
  const siteSearchInput = document.getElementById('site-search');
  if (siteSearchInput) {
    siteSearchInput.addEventListener('input', filterAndRenderSites);
  }

  // Edit / Delete config details
  function editSite(key, site) {
    editKeyInput.value = key;
    
    const cleanSite = {
      name: site.name,
      domainPattern: site.domainPattern,
      imageSelector: site.imageSelector,
      imageUrlAttribute: site.imageUrlAttribute || 'src',
      titleSelector: site.titleSelector || '',
      chapterSelector: site.chapterSelector || '',
      referer: site.referer || ''
    };
    if (site.isNsfw) cleanSite.isNsfw = true;
    if (site.nextPageSelector) cleanSite.nextPageSelector = site.nextPageSelector;
    if (site.imagesResponseFormat) cleanSite.imagesResponseFormat = site.imagesResponseFormat;
    if (site.imagesResultPath) cleanSite.imagesResultPath = site.imagesResultPath;
    if (site.imagesJsonVariable) cleanSite.imagesJsonVariable = site.imagesJsonVariable;

    if (site.searchUrl || site.searchResultSelector) {
      cleanSite.searchUrl = site.searchUrl || '';
      cleanSite.searchResultSelector = site.searchResultSelector || '';
      cleanSite.searchTitleSelector = site.searchTitleSelector || '';
      cleanSite.searchCoverSelector = site.searchCoverSelector || '';
      cleanSite.searchAuthorSelector = site.searchAuthorSelector || '';
      if (site.searchResponseFormat) cleanSite.searchResponseFormat = site.searchResponseFormat;
      if (site.searchResultPath) cleanSite.searchResultPath = site.searchResultPath;
      if (site.searchTitlePath) cleanSite.searchTitlePath = site.searchTitlePath;
      if (site.searchCoverPath) cleanSite.searchCoverPath = site.searchCoverPath;
      if (site.searchUrlPath) cleanSite.searchUrlPath = site.searchUrlPath;
      if (site.searchAuthorPath) cleanSite.searchAuthorPath = site.searchAuthorPath;
    }

    jsonConfigInput.value = JSON.stringify(cleanSite, null, 2);
    cancelEditBtn.style.display = 'inline-block';
    
    const configTab = document.querySelector('[data-tab="add-site"]');
    if (configTab) configTab.click();
  }

  async function deleteSite(key) {
    if (!confirm(`Bạn có chắc chắn muốn xóa cấu hình website ${key}?`)) return;
    delete allSites[key];
    pinnedSites = pinnedSites.filter(k => k !== key);
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ sites: allSites, pinnedSites });
    }
    showNotification(`Đã xóa cấu hình website ${key}.`, 'warning');
    filterAndRenderSites();
  }

  function resetForm() {
    editKeyInput.value = '';
    jsonConfigInput.value = '';
    cancelEditBtn.style.display = 'none';
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', resetForm);
  }

  // Config form submit
  configForm.addEventListener('submit', async e => {
    e.preventDefault();

    const jsonStr = jsonConfigInput.value.trim();
    if (!jsonStr) {
      alert('Vui lòng nhập nội dung cấu hình JSON.');
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      alert(`Lỗi cú pháp JSON:\n- ${parseErr.message}`);
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      alert('Cấu hình JSON phải là một đối tượng (Object).');
      return;
    }

    if (!parsed.name || !parsed.domainPattern) {
      alert('Cấu hình JSON thiếu trường "name" hoặc "domainPattern".');
      return;
    }

    // Normalize search parameters
    if (typeof parsed.searchUrl === 'string') {
      parsed.searchUrl = parsed.searchUrl.replace(/\{keyword\}/gi, '{query}');
    }
    if (parsed.searchUrl && parsed.searchResultSelector) {
      parsed.searchSupported = true;
    }

    const editKey = editKeyInput.value.trim();
    const validationKey = editKey || Security.slugKey(parsed.name);

    const result = Security.validateSiteProfile(validationKey, parsed);
    if (!result.valid) {
      alert(`Cấu hình không hợp lệ:\n- ${result.errors.join('\n- ')}`);
      return;
    }

    const finalKey = result.key;

    if (editKey && editKey !== finalKey) {
      delete allSites[editKey];
    }

    allSites[finalKey] = result.site;

    // Save
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ sites: allSites });
      
      // Request background to run merge and validation to apply default values
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'INITIALIZE_SITES' }, () => {
            resolve();
          });
        });
      } catch (e) {
        console.error('Failed to notify background to initialize sites:', e);
      }
    }

    showNotification(`Đã lưu cấu hình trang web "${result.site.name}"!`, 'success');
    resetForm();
    await loadSites();

    const listTab = document.querySelector('[data-tab="sites-list"]');
    if (listTab) listTab.click();
  });



  // Paste AI config from clipboard and save directly
  const btnPasteAiConfig = document.getElementById('btn-paste-ai-config');
  if (btnPasteAiConfig) {
    btnPasteAiConfig.addEventListener('click', async () => {
      try {
        let text = '';
        try {
          text = await navigator.clipboard.readText();
        } catch (clipErr) {
          text = prompt('Vui lòng dán văn bản cấu hình AI đã sao chép vào đây:');
        }

        if (!text || !text.trim()) {
          showNotification('Không tìm thấy nội dung văn bản để dán.', 'warning');
          return;
        }

        // Extract JSON substring (find first '{' and last '}')
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
          showNotification('Không tìm thấy dữ liệu JSON hợp lệ.', 'error');
          return;
        }

        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        let parsed = JSON.parse(jsonStr);

        if (!parsed || typeof parsed !== 'object') {
          showNotification('Dữ liệu phân tích được không phải là JSON Object.', 'error');
          return;
        }

        // If it's a map of sites, extract the first one
        if (!parsed.name && !parsed.domainPattern) {
          const keys = Object.keys(parsed);
          if (keys.length > 0 && parsed[keys[0]] && typeof parsed[keys[0]] === 'object') {
            parsed = parsed[keys[0]];
          } else {
            showNotification('Cấu trúc JSON dán vào không hợp lệ.', 'error');
            return;
          }
        }

        if (!parsed.name || !parsed.domainPattern) {
          showNotification('Cấu hình JSON thiếu trường name hoặc domainPattern.', 'error');
          return;
        }

        // Normalize search parameters
        if (typeof parsed.searchUrl === 'string') {
          parsed.searchUrl = parsed.searchUrl.replace(/\{keyword\}/gi, '{query}');
        }
        if (parsed.searchUrl && parsed.searchResultSelector) {
          parsed.searchSupported = true;
        }

        // Validate and sanitize using Security module
        const validationKey = Security.slugKey(parsed.name);
        const result = Security.validateSiteProfile(validationKey, parsed);
        if (!result.valid) {
          showNotification(`Cấu hình không hợp lệ: ${result.errors.join(', ')}`, 'error');
          return;
        }

        const finalKey = result.key;
        allSites[finalKey] = result.site;

        // Save directly to storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ sites: allSites });
          
          // Request background to run merge and validation to apply default values
          try {
            await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'INITIALIZE_SITES' }, () => {
                resolve();
              });
            });
          } catch (e) {
            console.error('Failed to notify background to initialize sites:', e);
          }
        }

        showNotification(`Đã nhập và lưu thành công cấu hình "${result.site.name}"!`, 'success');
        jsonConfigInput.value = JSON.stringify(result.site, null, 2);

        await loadSites();

        const listTab = document.querySelector('[data-tab="sites-list"]');
        if (listTab) {
          setTimeout(() => listTab.click(), 1000);
        }
      } catch (err) {
        console.error('Failed to parse and save pasted AI config:', err);
        showNotification('Lỗi khi phân tích hoặc lưu cấu hình dán vào.', 'error');
      }
    });
  }



  // Smart Diagnostics Event Listener
  const smartDiagnosticsBtn = document.getElementById('btn-smart-diagnostics');
  const smartResultsDiv = document.getElementById('smart-diagnostics-results');
  const smartContent = document.getElementById('smart-diagnostics-content');
  const smartCloseBtn = document.getElementById('smart-diag-close');

  if (smartCloseBtn && smartResultsDiv) {
    smartCloseBtn.addEventListener('click', () => {
      smartResultsDiv.style.display = 'none';
    });
  }

  // Diagnostic copy action listener
  const smartDiagCopyBtn = document.getElementById('smart-diag-copy');
  if (smartDiagCopyBtn && smartContent) {
    smartDiagCopyBtn.addEventListener('click', async () => {
      try {
        const text = smartContent.innerText || '';
        if (!text || text.includes('Đang khởi chạy') || text.includes('kết nối Content Script')) {
          return;
        }
        await copyText(text);
        const originalText = smartDiagCopyBtn.textContent;
        smartDiagCopyBtn.textContent = 'ĐÃ SAO CHÉP!';
        smartDiagCopyBtn.style.color = '#34D399';
        setTimeout(() => {
          smartDiagCopyBtn.textContent = originalText;
          smartDiagCopyBtn.style.color = '#3B82F6';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy smart diagnostics text:', error);
      }
    });
  }

  if (smartDiagnosticsBtn && smartResultsDiv && smartContent) {
    smartDiagnosticsBtn.addEventListener('click', async () => {
      smartResultsDiv.style.display = 'block';
      smartContent.innerHTML = '<div style="color: #3B82F6; font-weight: 600; text-align: center; animation: pulse 1s infinite;">Đang khởi chạy hệ thống chẩn đoán...</div>';
      
      const appendStep = (text, type = 'info') => {
        let color = '#94A3B8';
        let prefix = 'ℹ️ ';
        if (type === 'success') {
          color = '#34d399';
          prefix = '✅ ';
        } else if (type === 'warning') {
          color = '#FBBF24';
          prefix = '⚠️ ';
        } else if (type === 'danger') {
          color = '#F87171';
          prefix = '❌ ';
        }
        const div = document.createElement('div');
        div.style.color = color;
        div.style.marginBottom = '6px';
        div.style.display = 'flex';
        div.style.alignItems = 'flex-start';
        div.style.gap = '6px';
        div.innerHTML = `<span style="flex-shrink:0;">${prefix}</span><span>${text}</span>`;
        smartContent.appendChild(div);
        smartResultsDiv.scrollTop = smartResultsDiv.scrollHeight;
      };

      try {
        const tab = await getActiveTab();
        if (!tab || !tab.id || !tab.url) {
          smartContent.innerHTML = '';
          appendStep('Không tìm thấy tab hoạt động hoặc trình duyệt không cho phép truy cập.', 'danger');
          return;
        }

        smartContent.innerHTML = '';
        appendStep(`Đang kiểm tra tab: <strong>${tab.title || 'Manga'}</strong>`, 'info');

        const url = tab.url;
        if (!url.startsWith('http:') && !url.startsWith('https:')) {
          appendStep('Tiện ích chỉ hoạt động trên các trang web có giao thức HTTP/HTTPS. Trang hệ thống này không được hỗ trợ.', 'danger');
          return;
        }

        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.toLowerCase();
        appendStep(`Tên miền hiện tại: <strong>${host}</strong>`, 'info');

        appendStep('Đang kiểm tra cơ sở dữ liệu cấu hình lưu trữ...', 'info');
        const storageData = await chrome.storage.local.get('sites');
        const sites = storageData.sites || {};
        let matchedProfile = null;
        let matchedKey = null;

        for (const [key, site] of Object.entries(sites)) {
          if (site && site.domainPattern && Security.safeRegexTest(site.domainPattern, host)) {
            matchedProfile = site;
            matchedKey = key;
            break;
          }
        }

        if (matchedProfile) {
          appendStep(`Tìm thấy cấu hình khớp với website: <strong>${matchedProfile.name}</strong> (\`${matchedKey}\`)`, 'success');
        } else {
          appendStep('Không tìm thấy cấu hình khớp với website này trong bộ nhớ tiện ích.', 'warning');
          appendStep('Gợi ý: Hãy lấy cấu hình tạo bởi AI dán vào tab "Cấu hình" để lưu trữ.', 'info');
        }

        appendStep('Đang kết nối tới Content Script trên trang...', 'info');
        
        chrome.tabs.sendMessage(tab.id, { type: 'RUN_SMART_DIAGNOSTICS' }, async (response) => {
          const executeSearchDiagnostics = (matchedSite, testQuery, refererUrl) => {
            if (!matchedSite) return;
            
            appendStep('---', 'info');
            
            if (!matchedSite.searchSupported || !matchedSite.searchUrl) {
              appendStep('Tìm kiếm: Tính năng tìm kiếm đang bị TẮT hoặc thiếu URL tìm kiếm (`searchUrl`).', 'warning');
              return;
            }

            const queryStr = testQuery || 'One Piece';
            const testSearchUrl = matchedSite.searchUrl.replace('{query}', encodeURIComponent(queryStr));
            appendStep(`Tìm kiếm: Bắt đầu chẩn đoán Tìm kiếm với từ khóa "<strong>${queryStr}</strong>"...`, 'info');
            appendStep(`Tìm kiếm: Thử nghiệm tải trang kết quả bằng URL: \`${testSearchUrl}\``, 'info');

            chrome.runtime.sendMessage({
              type: 'FETCH_HTML',
              data: { url: testSearchUrl, referer: refererUrl }
            }, response => {
              if (chrome.runtime.lastError || !response) {
                appendStep('Tìm kiếm: Không nhận được phản hồi từ background.', 'danger');
                return;
              }
              if (!response.success) {
                appendStep(`Tìm kiếm: Tải trang tìm kiếm thất bại. Lỗi: ${response.error}`, 'danger');
                if (response.error && (response.error.includes('403') || response.error.includes('503') || response.error.includes('cloudflare'))) {
                  appendStep('Gợi ý: Trang tìm kiếm của website đang bị Cloudflare chặn. Hãy thử mở lại trang đọc trong tab mới để xác thực Cloudflare rồi chạy lại chẩn đoán.', 'warning');
                }
                return;
              }

              appendStep('Tìm kiếm: Tải trang tìm kiếm thành công! Bắt đầu phân tích cấu trúc kết quả...', 'success');
              
              try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.html, 'text/html');
                
                const resultSelector = matchedSite.searchResultSelector;
                if (!resultSelector) {
                  appendStep('CẢNH BÁO: Chưa cấu hình bộ chọn danh sách kết quả tìm kiếm (searchResultSelector). Không thể bóc tách kết quả.', 'danger');
                  return;
                }
                
                const items = doc.querySelectorAll(resultSelector);
                if (items.length === 0) {
                  appendStep(`Tìm kiếm: Không tìm thấy phần tử nào khớp với searchResultSelector (\`${resultSelector}\`). Có thể cấu hình bộ chọn bị sai, trang kết quả rỗng, hoặc trang tìm kiếm sử dụng JavaScript (Single Page App) để render động.`, 'danger');
                  appendStep('Gợi ý: Nếu trang web là Single Page App tải dữ liệu bằng API (như một số trang tải động), bạn cần viết case API/POST cụ thể trong background service worker thay vì dùng bộ chọn HTML thông thường.', 'info');
                  return;
                }
                
                appendStep(`Tìm kiếm: Tìm thấy ${items.length} phần tử truyện khớp với bộ chọn \`${resultSelector}\`.`, 'success');
                
                const firstItem = items[0];
                
                // Title Selector
                const titleSelector = matchedSite.searchTitleSelector || 'a';
                const titleEl = firstItem.querySelector(titleSelector);
                if (titleEl && titleEl.textContent.trim()) {
                  appendStep(`Tìm kiếm: Nhận diện thành công tên truyện mẫu: "<strong>${titleEl.textContent.trim()}</strong>" (bằng selector \`${titleSelector}\`)`, 'success');
                } else {
                  appendStep(`Tìm kiếm: Không tìm thấy thẻ chứa tên truyện bằng selector \`${titleSelector}\`.`, 'danger');
                }
                
                // Cover Selector
                const coverSelector = matchedSite.searchCoverSelector || 'img';
                const coverEl = firstItem.querySelector(coverSelector);
                if (coverEl) {
                  const coverUrl = coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || coverEl.getAttribute('data-original') || '';
                  if (coverUrl) {
                    appendStep(`Tìm kiếm: Nhận diện thành công link ảnh bìa mẫu: \`${coverUrl.substring(0, 80)}...\` (bằng selector \`${coverSelector}\`)`, 'success');
                  } else {
                    appendStep(`Tìm kiếm: Tìm thấy ảnh bằng selector \`${coverSelector}\` nhưng thuộc tính src/data-src trống.`, 'warning');
                  }
                } else {
                  appendStep(`Tìm kiếm: Không tìm thấy thẻ ảnh bìa bằng selector \`${coverSelector}\`.`, 'warning');
                }

                // Author Selector
                if (matchedSite.searchAuthorSelector) {
                  const authorEl = firstItem.querySelector(matchedSite.searchAuthorSelector);
                  if (authorEl && authorEl.textContent.trim()) {
                    appendStep(`Tìm kiếm: Nhận diện thành công tác giả mẫu: "<strong>${authorEl.textContent.trim()}</strong>" (bằng selector \`${matchedSite.searchAuthorSelector}\`)`, 'success');
                  } else {
                    appendStep(`Tìm kiếm: Không tìm thấy tác giả bằng selector \`${matchedSite.searchAuthorSelector}\`.`, 'warning');
                  }
                }
              } catch (e) {
                appendStep(`Tìm kiếm: Gặp lỗi trong quá trình phân tích cú pháp HTML kết quả: ${e.message}`, 'danger');
              }
            });
          };

          if (chrome.runtime.lastError || !response) {
            appendStep('Kết nối thất bại! Content Script không phản hồi.', 'danger');
            appendStep('Nguyên nhân: Trang web chưa được tải đầy đủ, hoặc bạn cần tải lại trang đọc truyện (F5) để kích hoạt tiện ích.', 'warning');
            if (!matchedProfile) {
              appendStep('Ngoài ra, vì website này chưa khớp cấu hình nào, tiện ích có thể đã chủ động bỏ qua không inject script.', 'info');
            }
            return;
          }

          if (!response.success) {
            appendStep(`Lỗi thực thi kiểm tra từ trang: ${response.error}`, 'danger');
            return;
          }

          appendStep('Kết nối Content Script thành công! Bắt đầu phân tích dữ liệu trang...', 'success');
          
          const diag = response.diagnostics;

          if (diag.siteType && diag.siteType.type) {
            appendStep(`Nền tảng website nhận diện được: <strong>${diag.siteType.type}</strong>`, 'success');
          }

          // Check if they are on a manga reading page (chapter page)
          if (diag.isChapterPage === false) {
            appendStep('CẢNH BÁO: Bạn CHƯA vào trang đọc truyện (trang chứa nội dung chương truyện). Vui lòng click chọn đọc một chương trước khi tiến hành tải.', 'danger');
          } else {
            appendStep('Xác nhận: Trình duyệt đang ở đúng trang đọc truyện (trang chương).', 'success');
          }

          // Check if they are at the top of the page (scrollY is 0 or very small)
          if (diag.isChapterPage !== false) {
            if (diag.scrollY < 250) {
              appendStep('CẢNH BÁO: Vị trí cuộn trang hiện tại bằng 0 (đang ở đầu trang).', 'warning');
              appendStep('Nhiều website truyện tranh (ví dụ: MangaPlaza, EbookRenta...) chỉ thực sự tải ảnh hoặc giải mã canvas khi người dùng cuộn chuột qua. Hãy cuộn từ từ xuống cuối trang truyện rồi chạy lại chẩn đoán.', 'info');
            } else {
              appendStep(`Vị trí cuộn trang hiện tại: ${Math.round(diag.scrollY)}px.`, 'success');
            }
          }

          if (diag.botWallDetected) {
            appendStep(`Phát hiện hệ thống chống bot: <strong>${diag.botWallDetected}</strong>. Điều này có thể làm nghẽn kết nối tải ảnh tự động.`, 'warning');
          }

          if (diag.matchedSite) {
            appendStep(`Bộ chọn ảnh đang sử dụng: \`${diag.imagesInfo.selectorUsed}\``, 'info');
            
            if (diag.imagesInfo.elementsFound === 0) {
              if (diag.isChapterPage === false) {
                appendStep(`Không tìm thấy phần tử nào khớp với bộ chọn ảnh. Điều này là bình thường do bạn đang ở trang chủ hoặc trang thông tin truyện.`, 'info');
              } else {
                appendStep(`Không tìm thấy phần tử nào khớp với bộ chọn ảnh. Cấu trúc trang web đã thay đổi hoặc cấu hình bộ chọn (imageSelector) bị sai.`, 'danger');
                appendStep('Cách sửa: Hãy kiểm tra mã nguồn HTML của trang bằng phím F12 để cập nhật lại selector cho chính xác.', 'warning');
              }
            } else {
              appendStep(`Tìm thấy ${diag.imagesInfo.elementsFound} phần tử khớp với bộ chọn ảnh.`, 'success');
              
              if (diag.imagesInfo.canvasCount > 0) {
                appendStep(`Phát hiện ${diag.imagesInfo.canvasCount} canvas vẽ ảnh trực tiếp (đọc sách trực tuyến).`, 'info');
                appendStep(`Bộ đệm canvas đã thu thập: ${diag.imagesInfo.canvasCachedCount}/${diag.imagesInfo.canvasCount} ảnh.`, diag.imagesInfo.canvasCachedCount === diag.imagesInfo.canvasCount ? 'success' : 'warning');
                if (diag.imagesInfo.canvasCachedCount < diag.imagesInfo.canvasCount) {
                  appendStep('Gợi ý: Hãy cuộn từ từ xuống cuối trang truyện để tiện ích tự động chụp và cache lại các canvas.', 'info');
                }
              }

              if (diag.imagesInfo.validUrlsFound > 0) {
                appendStep(`Đã lọc ra ${diag.imagesInfo.validUrlsFound} link ảnh hợp lệ có thể tải.`, 'success');
              } else if (diag.imagesInfo.canvasCount === 0) {
                appendStep(`Không trích xuất được link ảnh nào bằng thuộc tính \`${diag.matchedSite.imageUrlAttribute}\`.`, 'danger');
                appendStep(`Có ${diag.imagesInfo.emptySrcCount} thẻ ảnh trống hoặc không chứa thuộc tính này. Bạn nên thử đổi imageUrlAttribute sang 'data-src', 'data-original' hoặc tương ứng.`, 'warning');
              }
            }

            if (diag.imagesInfo.lazyLoadedCount > 0) {
              appendStep(`Có ${diag.imagesInfo.lazyLoadedCount} ảnh ở trạng thái Lazy-Load chưa được trình duyệt tải xuống.`, 'warning');
              appendStep('Gợi ý: Hãy bật cuộn trang tự động khi mở bảng điều khiển tải truyện để kích hoạt tải ảnh.', 'info');
            }

            if (diag.metaInfo.titleSelector) {
              if (diag.metaInfo.titleMatched) {
                appendStep(`Đã nhận diện Tên truyện: "<strong>${diag.metaInfo.titleText}</strong>"`, 'success');
              } else {
                if (diag.isChapterPage === false) {
                  appendStep(`Không tìm thấy tên truyện bằng bộ chọn \`${diag.metaInfo.titleSelector}\` (bình thường khi ở trang chủ/thông tin).`, 'info');
                } else {
                  appendStep(`Không tìm thấy tên truyện bằng bộ chọn \`${diag.metaInfo.titleSelector}\`.`, 'warning');
                }
              }
            }
            if (diag.metaInfo.chapterSelector) {
              if (diag.metaInfo.chapterMatched) {
                appendStep(`Đã nhận diện Chương truyện: "<strong>${diag.metaInfo.chapterText}</strong>"`, 'success');
              } else {
                if (diag.isChapterPage === false) {
                  appendStep(`Không tìm thấy chương truyện bằng bộ chọn \`${diag.metaInfo.chapterSelector}\` (bình thường khi ở trang chủ/thông tin).`, 'info');
                } else {
                  appendStep(`Không tìm thấy chương truyện bằng bộ chọn \`${diag.metaInfo.chapterSelector}\`.`, 'warning');
                }
              }
            }

            if (diag.imagesInfo.sampleImageUrl) {
              appendStep('Đang thử tải thử nghiệm ảnh mẫu qua Background Service Worker...', 'info');
              
              chrome.runtime.sendMessage({
                type: 'FETCH_GROUP_DATA',
                data: {
                  urls: [diag.imagesInfo.sampleImageUrl],
                  referer: url
                }
              }, (results) => {
                if (chrome.runtime.lastError || !results || !results[0]) {
                  appendStep('Background fetch test: Không nhận được phản hồi từ background.', 'danger');
                  executeSearchDiagnostics(matchedProfile, diag.metaInfo.titleText, url);
                  return;
                }
                const res = results[0];
                if (res.success) {
                  appendStep('Background fetch test thành công! Kết nối mạng và bộ bypass referer hoạt động khỏe mạnh.', 'success');
                  
                  const mimeMatch = res.dataUrl.match(/^data:([^;]+);/);
                  const mime = mimeMatch ? mimeMatch[1] : 'unknown';
                  appendStep(`Định dạng ảnh gốc phân tích được: <strong>${mime.toUpperCase()}</strong>`, 'info');
                } else {
                  appendStep(`Background fetch test thất bại! Lỗi tải ảnh: ${res.error}`, 'danger');
                  
                  if (res.error && (res.error.includes('403') || res.error.includes('cloudflare') || res.error.includes('Forbidden'))) {
                    appendStep('Lưu ý đặc biệt: Trang web này đang được bảo vệ bởi Cloudflare hoặc chặn hotlinking gắt gao. Hãy mở trang web trực tiếp trên một tab mới để hoàn thành xác thực Cloudflare rồi thử lại.', 'warning');
                  } else {
                    appendStep('Nguyên nhân: Trang web chặn tải gián tiếp, hoặc máy chủ chặn IP của bạn, hoặc cấu hình header Referer bị sai.', 'warning');
                  }
                }
                executeSearchDiagnostics(matchedProfile, diag.metaInfo.titleText, url);
              });
            } else if (diag.imagesInfo.canvasCount === 0) {
              appendStep('Không thể chạy kết nối mạng thử nghiệm do không trích xuất được link ảnh nào.', 'warning');
              executeSearchDiagnostics(matchedProfile, diag.metaInfo.titleText, url);
            } else {
              executeSearchDiagnostics(matchedProfile, diag.metaInfo.titleText, url);
            }
          } else {
            appendStep('Phân tích kết thúc: Vui lòng cấu hình website trước để chạy chẩn đoán chuyên sâu.', 'warning');
          }
        });
      } catch (error) {
        appendStep(`Đã xảy ra lỗi hệ thống chẩn đoán: ${error.message}`, 'danger');
        Security.logDiagnostic({ feature: 'smart_diagnostics', error });
      }
    });
  }

  // Theme Toggle (Light / Dark / Grayscale Cycles)
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    const sunIcon = themeToggleBtn.querySelector('.icon-sun');
    const moonIcon = themeToggleBtn.querySelector('.icon-moon');
    const contrastIcon = themeToggleBtn.querySelector('.icon-contrast');
 
    const applyTheme = theme => {
      document.body.classList.remove('light-theme', 'grayscale-theme');
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'none';
      if (contrastIcon) contrastIcon.style.display = 'none';

      if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (sunIcon) sunIcon.style.display = 'block';
      } else if (theme === 'grayscale') {
        document.body.classList.add('grayscale-theme');
        if (contrastIcon) contrastIcon.style.display = 'block';
      } else {
        // Dark theme (default)
        if (moonIcon) moonIcon.style.display = 'block';
      }

      // Re-render search badges to recalculate colors matching the theme
      renderSearchBadges();
      renderNsfwSearchBadges();
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('theme', data => applyTheme(data.theme || 'dark'));
    }

    themeToggleBtn.addEventListener('click', () => {
      let newTheme = 'dark';
      if (document.body.classList.contains('light-theme')) {
        newTheme = 'grayscale';
      } else if (!document.body.classList.contains('grayscale-theme')) {
        newTheme = 'light';
      }
      applyTheme(newTheme);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: newTheme });
      }
    });
  }

  // Easter Egg NSFW Mode Toggle via Logo Clicking
  const logoArea = document.querySelector('.logo-area');
  if (logoArea) {
    logoArea.style.cursor = 'pointer';
    logoArea.title = 'Manga Downloader';
    logoArea.addEventListener('click', async () => {
      logoClickCount++;
      if (logoClickTimeout) clearTimeout(logoClickTimeout);
      
      const requiredClicks = nsfwUnlockedBefore ? 2 : 18;
      
      // Reset clicks after 3 seconds of inactivity
      logoClickTimeout = setTimeout(() => {
        logoClickCount = 0;
      }, 3000);
      
      if (logoClickCount >= requiredClicks) {
        logoClickCount = 0;
        clearTimeout(logoClickTimeout);
        
        const newActive = !nsfwActive;
        const newUnlockedBefore = true;
        
        nsfwActive = newActive;
        nsfwUnlockedBefore = newUnlockedBefore;
        
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({
            nsfwActive: newActive,
            nsfwUnlockedBefore: newUnlockedBefore
          });
        }
        
        applyNsfwModeUI(newActive);
        showNotification(newActive ? 'Đã mở khóa chế độ 18+!' : 'Đã khóa chế độ 18+.', newActive ? 'success' : 'warning');
      }
    });
  }

  // Active tab check on load
  async function checkActiveTabStatus() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.url) return;
      const tabUrl = Security.normalizeUrl(tab.url, { allowHttp: true });
      if (!tabUrl) return;
      const tabUrlObj = new URL(tabUrl);
      const tabHost = tabUrlObj.hostname.toLowerCase();

      // Auto-fill AI prompt generator fields from the active tab
      if (tab.url && !tab.url.startsWith('chrome:')) {
        const aiSiteNameEl = document.getElementById('ai-site-name');
        const aiSampleUrlEl = document.getElementById('ai-sample-url');
        if (aiSiteNameEl && aiSampleUrlEl) {
          const cleanHost = tabHost.replace(/^www\./, '');
          const cleanName = cleanHost.split('.')[0];
          const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          
          aiSiteNameEl.value = capitalizedName;
          aiSampleUrlEl.value = tab.url;

          if (window.SitesManager && typeof window.SitesManager.generateAiPrompt === 'function') {
            window.SitesManager.generateAiPrompt();
          }

          // Capture DOM snapshot and send it to SitesManager
          chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_SANITIZED_DOM' }, response => {
            if (!chrome.runtime.lastError && response && response.success && response.snapshot) {
              if (window.SitesManager && typeof window.SitesManager.setDomSnapshot === 'function') {
                window.SitesManager.setDomSnapshot(response.snapshot.html);
              }
            }
          });

          // Asynchronously fetch the homepage to extract search selectors if not already on it
          try {
            const parsedTabUrl = new URL(tab.url);
            const homepageUrl = parsedTabUrl.origin + '/';
            if (parsedTabUrl.pathname !== '/' && parsedTabUrl.pathname !== '') {
              chrome.runtime.sendMessage({
                type: 'FETCH_HTML',
                data: { url: homepageUrl, referer: tab.url }
              }, response => {
                if (response && response.success && response.html) {
                  if (window.SitesManager && typeof window.SitesManager.extractAndSetHomepageSearchDom === 'function') {
                    window.SitesManager.extractAndSetHomepageSearchDom(response.html);
                  }
                }
              });
            } else {
              if (window.SitesManager && typeof window.SitesManager.clearHomepageSearchDom === 'function') {
                window.SitesManager.clearHomepageSearchDom();
              }
            }
          } catch (e) {
            console.warn('Failed to parse tab URL for homepage fetch:', e);
          }
        }
      }

      const data = await chrome.storage.local.get('sites');
      const sites = validateAndStoreSites(data.sites || {});
      let matchedSite = null;
      for (const site of Object.values(sites)) {
        if (Security.safeRegexTest(site.domainPattern, tabHost)) {
          matchedSite = site;
          break;
        }
      }

      const notificationArea = document.getElementById('status-notification-area');
      if (!notificationArea) return;
      clearElement(notificationArea);

      if (!matchedSite) {
        const isLikelyManga = /chapter|chap|truyen|manga|comic|detail/i.test(tabUrlObj.pathname + tabUrlObj.search);
        if (!isLikelyManga) return;
        const host = tabHost.replace(/^www\./, '');
        
        const alertBox = makeStatusAlert('warning', ICONS.warning, content => {
          const line = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = 'Trang chưa được hỗ trợ: ';
          const code = document.createElement('code');
          code.textContent = host;
          line.append(strong, document.createTextNode('Trang web '), code, document.createTextNode(' này chưa có cấu hình.'));

          const actionsRow = document.createElement('div');
          actionsRow.style.marginTop = '8px';
          actionsRow.style.display = 'flex';
          actionsRow.style.gap = '8px';

          const quickAdd = document.createElement('button');
          quickAdd.type = 'button';
          quickAdd.className = 'status-alert-btn';
          appendText(quickAdd, 'Thêm nhanh', '');
          quickAdd.addEventListener('click', () => {
            const domainKeywords = Security.slugKey(host.split('.')[0]);
            const cleanSite = {
              name: domainKeywords.charAt(0).toUpperCase() + domainKeywords.slice(1),
              domainPattern: domainKeywords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              imageSelector: '',
              imageUrlAttribute: 'src',
              titleSelector: '',
              chapterSelector: '',
              referer: tabUrlObj.origin + '/'
            };
            jsonConfigInput.value = JSON.stringify(cleanSite, null, 2);
            const addTab = document.querySelector('[data-tab="add-site"]');
            if (addTab) addTab.click();
          });

          actionsRow.append(quickAdd);
          content.append(line, actionsRow);
        });
        notificationArea.appendChild(alertBox);
      }
    } catch (err) {
      console.warn('Failed to check active tab status:', err);
    }
  }

  // Trigger GitHub sync message listener
  const syncBtn = document.getElementById('btn-sync-github');
  if (syncBtn) {
    const syncSpan = syncBtn.querySelector('span');
    syncBtn.addEventListener('click', () => {
      syncBtn.disabled = true;
      if (syncSpan) syncSpan.textContent = 'Syncing...';

      chrome.runtime.sendMessage({ type: 'TRIGGER_GITHUB_SYNC' }, response => {
        syncBtn.disabled = false;
        if (syncSpan) syncSpan.textContent = 'Sync GitHub';
        if (response && response.success) {
          loadSites();
          alert(`Đồng bộ thành công! Đã nạp ${response.count} cấu hình từ GitHub.${response.skipped ? ` Bỏ qua ${response.skipped} cấu hình không hợp lệ.` : ''}`);
        } else {
          alert(`Lỗi đồng bộ: ${Security.toSafeString(response && response.error || 'Không phản hồi từ Background service', 200)}`);
        }
      });
    });
  }

  // Trigger Reset Defaults
  const resetBtn = document.getElementById('btn-reset-defaults');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn nạp lại danh sách cấu hình mặc định? Việc này sẽ ghi đè các cấu hình trùng tên.')) return;
      try {
        const sites = validateAndStoreSites(self.DEFAULT_SITES || {});
        const stored = await chrome.storage.local.get('sites');
        const mergedSites = validateAndStoreSites({ ...(stored.sites || {}), ...sites });
        await chrome.storage.local.set({ sites: mergedSites });
        loadSites();
        alert('Đã cập nhật cấu hình mặc định thành công!');
      } catch (error) {
        Security.logDiagnostic({ feature: 'reset_defaults', error });
        alert('Lỗi khi nạp cấu hình mặc định!');
      }
    });
  }



  // Run initialization routines
  await loadSites();

  // Initialize managers, passing the MangaPopup namespace
  if (window.ThemeManager) window.ThemeManager.init(window.MangaPopup);
  if (window.SitesManager) window.SitesManager.init(window.MangaPopup);
  if (window.SearchManager) window.SearchManager.init(window.MangaPopup);

  checkActiveTabStatus();
  refreshDiagnosticCount();
});
