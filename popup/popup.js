// Popup Dashboard logic for Manga Downloader Premium

document.addEventListener('DOMContentLoaded', () => {
  const Security = window.MangaSecurity;

  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const sitesContainer = document.getElementById('sites-container');
  const sitesCount = document.getElementById('sites-count');
  const configForm = document.getElementById('config-form');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const editKeyInput = document.getElementById('edit-key');

  const siteNameInput = document.getElementById('site-name');
  const siteDomainInput = document.getElementById('site-domain');
  const imageSelectorInput = document.getElementById('image-selector');
  const imageAttrInput = document.getElementById('image-attr');
  const titleSelectorInput = document.getElementById('title-selector');
  const chapterSelectorInput = document.getElementById('chapter-selector');
  const siteRefererInput = document.getElementById('site-referer');

  const mangaSearchInput = document.getElementById('manga-search-input');
  const btnMangaSearch = document.getElementById('btn-manga-search');
  const mangaSearchLoading = document.getElementById('manga-search-loading');
  const mangaSearchResults = document.getElementById('manga-search-results');

  const diagnosticCount = document.getElementById('diagnostic-count');
  const diagnosticStatus = document.getElementById('diagnostic-status');

  let allSites = {};
  let pinnedSites = [];
 
  const ICONS = {
    open: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    delete: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-svg"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    pin: '<svg class="icon-pin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.54l-2.78 3.5a2 2 0 0 0-.44 1.24V17Z"/></svg>',
    pinned: '<svg class="icon-pin pinned" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.54l-2.78 3.5a2 2 0 0 0-.44 1.24V17Z"/></svg>'
  };

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
    btn.setAttribute('aria-label', title);
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

  async function loadSites() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    const data = await chrome.storage.local.get(['sites', 'pinnedSites']);
    pinnedSites = Array.isArray(data.pinnedSites) ? data.pinnedSites : [];
    allSites = validateAndStoreSites(data.sites || {});

    if (allSites.nettruyen) delete allSites.nettruyen;
    await chrome.storage.local.set({ sites: allSites });
    filterAndRenderSites();
  }

  function renderSiteCard(key, site) {
    const card = document.createElement('div');
    card.className = 'site-card';

    const cardMain = document.createElement('div');
    cardMain.className = 'site-card-main';

    const logoImg = document.createElement('img');
    logoImg.className = 'site-card-logo';
    let domain = 'mangadex.org';
    try {
      const openUrl = getSiteOpenUrl(site);
      if (openUrl) {
        domain = new URL(openUrl).hostname;
      }
    } catch (e) {}
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
    if (isPinned) {
      card.classList.add('pinned');
    }

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
      const openBtn = makeIconButton('btn-icon open-btn launch-btn', `Mở nhanh trang web: ${openUrl}`, ICONS.open);
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
    sitesContainer.appendChild(card);

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

  function filterAndRenderSites() {
    const searchQuery = document.getElementById('site-search').value.toLowerCase().trim();
    clearElement(sitesContainer);

    const filteredKeys = Object.keys(allSites).filter(key => {
      const site = allSites[key];
      return (
        Security.toSafeString(site.name).toLowerCase().includes(searchQuery) ||
        Security.toSafeString(site.domainPattern).toLowerCase().includes(searchQuery)
      );
    });

    // Sort: pinned sites first, then alphabetical by name
    filteredKeys.sort((a, b) => {
      const pinA = pinnedSites.includes(a) ? 1 : 0;
      const pinB = pinnedSites.includes(b) ? 1 : 0;
      if (pinA !== pinB) {
        return pinB - pinA;
      }
      const nameA = allSites[a].name.toLowerCase();
      const nameB = allSites[b].name.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    sitesCount.textContent = filteredKeys.length;
    if (filteredKeys.length === 0) {
      showBox(sitesContainer, Object.keys(allSites).length === 0 ? 'Chưa có cấu hình trang nào. Hãy thêm ở tab bên cạnh!' : 'Không tìm thấy trang web nào phù hợp!');
      return;
    }

    filteredKeys.forEach(key => renderSiteCard(key, allSites[key]));
  }

  function editSite(key, site) {
    editKeyInput.value = key;
    siteNameInput.value = site.name || '';
    siteDomainInput.value = site.domainPattern || '';
    imageSelectorInput.value = site.imageSelector || '';
    imageAttrInput.value = site.imageUrlAttribute || 'data-original|src';
    titleSelectorInput.value = site.titleSelector || '';
    chapterSelectorInput.value = site.chapterSelector || '';
    siteRefererInput.value = site.referer || '';
    cancelEditBtn.style.display = 'inline-block';
    const editTab = document.querySelector('[data-tab="add-site"]');
    if (editTab) editTab.click();
  }

  function resetForm() {
    configForm.reset();
    editKeyInput.value = '';
    cancelEditBtn.style.display = 'none';
  }

  cancelEditBtn.addEventListener('click', () => {
    resetForm();
    const listTab = document.querySelector('[data-tab="sites-list"]');
    if (listTab) listTab.click();
  });

  async function deleteSite(key) {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình này?')) return;
    const data = await chrome.storage.local.get('sites');
    const sites = data.sites || {};
    delete sites[key];
    await chrome.storage.local.set({ sites: validateAndStoreSites(sites) });
    loadSites();
  }

  configForm.addEventListener('submit', async e => {
    e.preventDefault();

    const rawSite = {
      name: siteNameInput.value,
      domainPattern: siteDomainInput.value,
      imageSelector: imageSelectorInput.value,
      imageUrlAttribute: imageAttrInput.value,
      titleSelector: titleSelectorInput.value,
      chapterSelector: chapterSelectorInput.value,
      referer: siteRefererInput.value
    };

    const key = editKeyInput.value || Security.slugKey(rawSite.name);
    const validation = Security.validateSiteProfile(key, rawSite);
    if (!validation.valid) {
      alert(`Cấu hình chưa hợp lệ: ${validation.errors.join(' ')}`);
      Security.logDiagnostic({ feature: 'site_form_validation', error: validation.errors.join('; ') });
      return;
    }

    const data = await chrome.storage.local.get('sites');
    const sites = data.sites || {};
    let finalKey = editKeyInput.value || validation.key;
    if (!editKeyInput.value && sites[finalKey]) finalKey = `${finalKey}_${Date.now()}`;
    sites[finalKey] = validation.site;

    await chrome.storage.local.set({ sites: validateAndStoreSites(sites) });
    resetForm();
    loadSites();
    const listTab = document.querySelector('[data-tab="sites-list"]');
    if (listTab) listTab.click();
  });

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

  const resetBtn = document.getElementById('btn-reset-defaults');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn nạp lại danh sách cấu hình mặc định từ file config/sites.json? Việc này sẽ ghi đè các cấu hình trùng tên.')) return;
      try {
        const response = await fetch(chrome.runtime.getURL('config/sites.json'));
        const sites = validateAndStoreSites(await response.json());
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

  async function checkActiveTabStatus() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.url) return;
      const tabUrl = Security.normalizeUrl(tab.url, { allowHttp: true });
      if (!tabUrl) return;
      const tabUrlObj = new URL(tabUrl);
      const tabHost = tabUrlObj.hostname.toLowerCase();

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
        notificationArea.appendChild(makeStatusAlert('warning', ICONS.warning, content => {
          const line = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = 'Trang chưa được hỗ trợ: ';
          const code = document.createElement('code');
          code.textContent = host;
          line.append(strong, document.createTextNode('Trang web '), code, document.createTextNode(' này chưa được đăng ký trong danh sách cấu hình.'));

          const quickAdd = document.createElement('button');
          quickAdd.type = 'button';
          quickAdd.className = 'status-alert-btn';
          appendText(quickAdd, '+', '');
          appendText(quickAdd, 'Thêm cấu hình nhanh cho trang này');
          quickAdd.addEventListener('click', () => {
            const domainKeywords = Security.slugKey(host.split('.')[0]);
            siteNameInput.value = domainKeywords.charAt(0).toUpperCase() + domainKeywords.slice(1);
            siteDomainInput.value = domainKeywords;
            siteRefererInput.value = tabUrlObj.origin + '/';
            const addTab = document.querySelector('[data-tab="add-site"]');
            if (addTab) addTab.click();
          });
          content.append(line, quickAdd);
        }));
      } else {
        notificationArea.appendChild(makeStatusAlert('success', ICONS.success, content => {
          const line = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = 'Đã hỗ trợ: ';
          const code = document.createElement('code');
          code.textContent = matchedSite.name;
          line.append(strong, document.createTextNode('Tiện ích đã nhận dạng và sẵn sàng tải trên trang '), code, document.createTextNode('!'));
          content.appendChild(line);
        }));
      }
    } catch (error) {
      Security.logDiagnostic({ feature: 'active_tab_status', error });
    }
  }

  const searchInput = document.getElementById('site-search');
  if (searchInput) searchInput.addEventListener('input', filterAndRenderSites);

  function renderSearchResult(rawItem) {
    const item = Security.normalizeSearchResult(rawItem);
    if (!item) return;

    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.style.cursor = 'pointer';

    const img = document.createElement('img');
    img.className = 'search-result-cover';
    img.alt = 'cover';
    img.src = item.thumbnail || chrome.runtime.getURL('icons/icon48.png');
    img.addEventListener('error', () => {
      img.src = chrome.runtime.getURL('icons/icon48.png');
    }, { once: true });

    const info = document.createElement('div');
    info.className = 'search-result-info';
    const title = document.createElement('div');
    title.className = 'search-result-title';
    title.title = item.title;
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';
    const source = document.createElement('span');
    source.className = `search-result-source ${item.sourceKey}`;
    
    const sourceLogo = document.createElement('img');
    sourceLogo.className = 'search-result-source-logo';
    let sourceDomain = 'mangadex.org';
    try {
      if (item.url) {
        sourceDomain = new URL(item.url).hostname;
      }
    } catch (e) {}
    sourceLogo.src = `https://www.google.com/s2/favicons?sz=32&domain=${sourceDomain}`;
    sourceLogo.addEventListener('error', () => {
      sourceLogo.style.display = 'none';
    }, { once: true });

    source.append(sourceLogo, document.createTextNode(item.source));

    const author = document.createElement('span');
    author.className = 'search-result-author';
    author.title = item.author;
    author.textContent = item.author;
    meta.append(source, author);
    info.append(title, meta);

    const openBtn = makeIconButton('btn-icon open-btn search-result-open', 'Mở truyện', ICONS.open);
    openBtn.addEventListener('click', e => {
      e.stopPropagation();
      safeOpenUrl(item.url);
    });
    card.addEventListener('click', () => safeOpenUrl(item.url));
    card.append(img, info, openBtn);
    mangaSearchResults.appendChild(card);
  }

  async function performMangaSearch() {
    const query = Security.toSafeString(mangaSearchInput.value, 100);
    if (!query) return;

    mangaSearchLoading.style.display = 'block';
    clearElement(mangaSearchResults);

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      mangaSearchLoading.style.display = 'none';
      showBox(mangaSearchResults, 'Trình duyệt không hỗ trợ tìm kiếm trực tiếp.');
      return;
    }

    chrome.runtime.sendMessage({ type: 'SEARCH_MANGA', data: { query } }, response => {
      mangaSearchLoading.style.display = 'none';
      clearElement(mangaSearchResults);

      if (response && response.success) {
        const results = Array.isArray(response.results) ? response.results : [];
        if (results.length === 0) {
          showBox(mangaSearchResults, 'Không tìm thấy truyện hoặc tác giả nào phù hợp trên các website hỗ trợ.', '40px 20px');
          return;
        }
        results.forEach(renderSearchResult);
      } else {
        showBox(mangaSearchResults, `Lỗi khi tìm kiếm: ${Security.toSafeString(response && response.error || 'Lỗi không xác định', 200)}`);
      }
    });
  }

  if (btnMangaSearch && mangaSearchInput) {
    btnMangaSearch.addEventListener('click', performMangaSearch);
    mangaSearchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') performMangaSearch();
    });
  }

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
    textarea.remove();
  }

  function setDiagnosticStatus(text, isError = false) {
    if (!diagnosticStatus) return;
    
    let indicatorEl = diagnosticStatus.querySelector('.status-indicator');
    let textEl = diagnosticStatus.querySelector('.status-text');
    
    if (!indicatorEl || !textEl) {
      diagnosticStatus.innerHTML = '<span class="status-indicator"></span><span class="status-text"></span>';
      indicatorEl = diagnosticStatus.querySelector('.status-indicator');
      textEl = diagnosticStatus.querySelector('.status-text');
    }
    
    textEl.textContent = text;
    indicatorEl.className = 'status-indicator ' + (isError ? 'error' : 'active');
    diagnosticStatus.style.color = isError ? 'var(--color-danger)' : 'var(--text-secondary)';
  }

  async function refreshDiagnosticCount() {
    if (!diagnosticCount) return;
    const events = await Security.getDiagnosticEvents();
    diagnosticCount.textContent = events.length;
  }

  const copyDiagnosticsBtn = document.getElementById('btn-copy-diagnostics');
  if (copyDiagnosticsBtn) {
    copyDiagnosticsBtn.addEventListener('click', async () => {
      try {
        const report = await Security.buildDiagnosticReport();
        await copyText(JSON.stringify(report, null, 2));
        setDiagnosticStatus(`Đã copy ${report.eventCount} sự kiện chẩn đoán.`);
      } catch (error) {
        setDiagnosticStatus('Không copy được diagnostic report.', true);
        Security.logDiagnostic({ feature: 'copy_diagnostics', error });
      }
    });
  }

  const exportDiagnosticsBtn = document.getElementById('btn-export-diagnostics');
  if (exportDiagnosticsBtn) {
    exportDiagnosticsBtn.addEventListener('click', async () => {
      try {
        const report = await Security.buildDiagnosticReport();
        await downloadJson(`manga-downloader-diagnostics-${Date.now()}.json`, report);
        setDiagnosticStatus(`Đã export ${report.eventCount} sự kiện chẩn đoán.`);
      } catch (error) {
        setDiagnosticStatus('Không export được diagnostic report.', true);
        Security.logDiagnostic({ feature: 'export_diagnostics', error });
      }
    });
  }

  const captureDomBtn = document.getElementById('btn-capture-dom');
  if (captureDomBtn) {
    captureDomBtn.addEventListener('click', async () => {
      try {
        const tab = await getActiveTab();
        const tabUrl = tab && tab.url ? Security.normalizeUrl(tab.url, { allowHttp: true }) : '';
        if (!tab || !tab.id || !tabUrl) {
          setDiagnosticStatus('Tab hiện tại không hỗ trợ capture DOM.', true);
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_SANITIZED_DOM' }, async response => {
          try {
            if (chrome.runtime.lastError || !response || !response.success) {
              const message = chrome.runtime.lastError ? chrome.runtime.lastError.message : (response && response.error) || 'Không có phản hồi từ content script.';
              setDiagnosticStatus(Security.toSafeString(message, 180), true);
              Security.logDiagnostic({ feature: 'capture_dom', error: message, url: tabUrl });
              return;
            }

            await downloadJson(`manga-downloader-dom-${Date.now()}.json`, response.snapshot);
            setDiagnosticStatus('Đã export DOM snapshot đã lọc.');
          } catch (error) {
            setDiagnosticStatus('Không export được DOM snapshot.', true);
            Security.logDiagnostic({ feature: 'capture_dom_export', error, url: tabUrl });
          }
        });
      } catch (error) {
        setDiagnosticStatus('Không capture được DOM.', true);
        Security.logDiagnostic({ feature: 'capture_dom', error });
      }
    });
  }

  const clearDiagnosticsBtn = document.getElementById('btn-clear-diagnostics');
  if (clearDiagnosticsBtn) {
    clearDiagnosticsBtn.addEventListener('click', async () => {
      if (!confirm('Xóa toàn bộ log chẩn đoán local?')) return;
      await Security.clearDiagnostics();
      await refreshDiagnosticCount();
      setDiagnosticStatus('Đã xóa log chẩn đoán.');
    });
  }

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
        if (moonIcon) moonIcon.style.display = 'block';
      }
    };
 
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('theme', data => applyTheme(data.theme || 'dark'));
    } else {
      applyTheme('dark');
    }
 
    themeToggleBtn.addEventListener('click', () => {
      let newTheme = 'dark';
      if (document.body.classList.contains('light-theme')) {
        newTheme = 'grayscale';
      } else if (document.body.classList.contains('grayscale-theme')) {
        newTheme = 'dark';
      } else {
        newTheme = 'light';
      }
      applyTheme(newTheme);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: newTheme });
      }
    });
  }

  loadSites();
  checkActiveTabStatus();
  refreshDiagnosticCount();
});
