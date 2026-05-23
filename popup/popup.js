// Popup Dashboard logic for Manga Downloader Premium

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const sitesContainer = document.getElementById('sites-container');
  const sitesCount = document.getElementById('sites-count');
  const configForm = document.getElementById('config-form');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const editKeyInput = document.getElementById('edit-key');

  // Input elements
  const siteNameInput = document.getElementById('site-name');
  const siteDomainInput = document.getElementById('site-domain');
  const imageSelectorInput = document.getElementById('image-selector');
  const imageAttrInput = document.getElementById('image-attr');
  const titleSelectorInput = document.getElementById('title-selector');
  const chapterSelectorInput = document.getElementById('chapter-selector');
  const siteRefererInput = document.getElementById('site-referer');

  let allSites = {};

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const activeTabId = tab.getAttribute('data-tab');
      document.getElementById(activeTabId).classList.add('active');
    });
  });

  // Load and display site profiles
  async function loadSites() {
    // Check if chrome.storage is available (runs in extension popup)
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn('Chrome storage not available. Using mockup data.');
      return;
    }

    const data = await chrome.storage.local.get('sites');
    allSites = data.sites || {};
    
    // Clean up nettruyen from local storage if still present
    if (allSites.nettruyen) {
      delete allSites.nettruyen;
      await chrome.storage.local.set({ sites: allSites });
    }

    filterAndRenderSites();
  }

  // Filter and render site profiles on the DOM
  function filterAndRenderSites() {
    const searchQuery = document.getElementById('site-search').value.toLowerCase().trim();
    sitesContainer.innerHTML = '';
    
    const filteredKeys = Object.keys(allSites).filter(key => {
      const site = allSites[key];
      return (
        site.name.toLowerCase().includes(searchQuery) ||
        site.domainPattern.toLowerCase().includes(searchQuery)
      );
    });

    sitesCount.textContent = filteredKeys.length;

    if (filteredKeys.length === 0) {
      sitesContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
          ${Object.keys(allSites).length === 0 ? 'Chưa có cấu hình trang nào. Hãy thêm ở tab bên cạnh!' : 'Không tìm thấy trang web nào phù hợp!'}
        </div>
      `;
      return;
    }

    filteredKeys.forEach(key => {
      const site = allSites[key];
      const card = document.createElement('div');
      card.className = 'site-card';
      
      // Determine quick open URL
      let openUrl = site.referer || '';
      if (!openUrl && site.domainPattern) {
        // Fallback to domain pattern if it looks like a clean domain
        const cleanDomain = site.domainPattern.split('|')[0].replace(/[^a-zA-Z0-9.-]/g, '');
        if (cleanDomain) {
          openUrl = `https://${cleanDomain}.com/`;
        }
      }

      const openButtonHtml = openUrl 
        ? `<button class="btn-icon open-btn launch-btn" data-url="${openUrl}" title="Mở nhanh trang web: ${openUrl}"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>`
        : '';

      card.innerHTML = `
        <div class="site-info">
          <h3>${site.name}</h3>
          <p>Mẫu miền: <code>${site.domainPattern}</code></p>
          <div class="site-status-container">
            <span class="status-dot checking" id="status-dot-${key}"></span>
            <span class="status-text" id="status-text-${key}">Đang kiểm tra...</span>
          </div>
        </div>
        <div class="site-actions">
          ${openButtonHtml}
          <button class="btn-icon edit-btn" data-key="${key}" title="Sửa"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
          <button class="btn-icon delete delete-btn" data-key="${key}" title="Xóa"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      `;
      sitesContainer.appendChild(card);
    });

    // Add event listeners to dynamically created launch, edit and delete buttons
    document.querySelectorAll('.launch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.getAttribute('data-url');
        if (url) {
          chrome.tabs.create({ url });
        }
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.getAttribute('data-key');
        editSite(key, allSites[key]);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.getAttribute('data-key');
        deleteSite(key);
      });
    });

    // Trigger asynchronous status checks via background worker
    filteredKeys.forEach(key => {
      const site = allSites[key];
      let openUrl = site.referer || '';
      if (!openUrl && site.domainPattern) {
        const cleanDomain = site.domainPattern.split('|')[0].replace(/[^a-zA-Z0-9.-]/g, '');
        if (cleanDomain) {
          openUrl = `https://${cleanDomain}.com/`;
        }
      }

      if (openUrl) {
        chrome.runtime.sendMessage({
          type: 'PING_SITE',
          data: { url: openUrl }
        }, (response) => {
          const dotEl = document.getElementById(`status-dot-${key}`);
          const textEl = document.getElementById(`status-text-${key}`);
          if (dotEl && textEl) {
            dotEl.classList.remove('checking');
            if (response && response.online) {
              dotEl.classList.add('active');
              textEl.textContent = 'Hoạt động';
              textEl.style.color = '#10b981';
            } else {
              dotEl.classList.add('inactive');
              textEl.textContent = 'Không hoạt động';
              textEl.style.color = '#ef4444';
            }
          }
        });
      } else {
        const dotEl = document.getElementById(`status-dot-${key}`);
        const textEl = document.getElementById(`status-text-${key}`);
        if (dotEl && textEl) {
          dotEl.classList.remove('checking');
          dotEl.classList.add('inactive');
          textEl.textContent = 'Không có URL';
        }
      }
    });
  }

  // Edit site profile
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
    
    // Switch to Add/Edit tab
    const editTab = document.querySelector('[data-tab="add-site"]');
    if (editTab) editTab.click();
  }

  // Cancel edit mode
  cancelEditBtn.addEventListener('click', () => {
    resetForm();
    // Switch back to List tab
    const listTab = document.querySelector('[data-tab="sites-list"]');
    if (listTab) listTab.click();
  });

  function resetForm() {
    configForm.reset();
    editKeyInput.value = '';
    cancelEditBtn.style.display = 'none';
  }

  // Delete site profile
  async function deleteSite(key) {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình này?')) return;

    const data = await chrome.storage.local.get('sites');
    const sites = data.sites || {};
    delete sites[key];

    await chrome.storage.local.set({ sites });
    loadSites();
  }

  // Handle Form Submission (Add or Update)
  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = siteNameInput.value.trim();
    const domainPattern = siteDomainInput.value.trim();
    const imageSelector = imageSelectorInput.value.trim();
    const imageUrlAttribute = imageAttrInput.value.trim();
    const titleSelector = titleSelectorInput.value.trim();
    const chapterSelector = chapterSelectorInput.value.trim();
    const referer = siteRefererInput.value.trim();

    const data = await chrome.storage.local.get('sites');
    const sites = data.sites || {};

    let key = editKeyInput.value;
    if (!key) {
      // Add mode: create a unique key based on name
      key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (sites[key]) {
        key = key + '_' + Date.now();
      }
    }

    sites[key] = {
      name,
      domainPattern,
      imageSelector,
      imageUrlAttribute,
      titleSelector,
      chapterSelector,
      referer
    };

    await chrome.storage.local.set({ sites });
    resetForm();
    loadSites();

    // Switch back to List tab
    const listTab = document.querySelector('[data-tab="sites-list"]');
    if (listTab) listTab.click();
  });

  // Sync from GitHub repo
  const syncBtn = document.getElementById('btn-sync-github');
  if (syncBtn) {
    const syncSpan = syncBtn.querySelector('span');
    syncBtn.addEventListener('click', () => {
      syncBtn.disabled = true;
      if (syncSpan) syncSpan.textContent = 'Syncing...';
      
      chrome.runtime.sendMessage({ type: 'TRIGGER_GITHUB_SYNC' }, (response) => {
        syncBtn.disabled = false;
        if (syncSpan) syncSpan.textContent = 'Sync GitHub';
        
        if (response && response.success) {
          loadSites();
          alert(`Đồng bộ thành công! Đã nạp ${response.count} cấu hình từ GitHub.`);
        } else {
          alert(`Lỗi đồng bộ: ${response ? response.error : 'Không phản hồi từ Background service'}`);
        }
      });
    });
  }

  // Reset default site profiles
  const resetBtn = document.getElementById('btn-reset-defaults');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc chắn muốn nạp lại danh sách cấu hình mặc định từ file config/sites.json? Việc này sẽ ghi đè các cấu hình trùng tên.')) return;
      try {
        const response = await fetch(chrome.runtime.getURL('config/sites.json'));
        const sites = await response.json();
        const stored = await chrome.storage.local.get('sites');
        const mergedSites = { ...(stored.sites || {}), ...sites };
        await chrome.storage.local.set({ sites: mergedSites });
        loadSites();
        alert('Đã cập nhật cấu hình mặc định thành công!');
      } catch (error) {
        console.error(error);
        alert('Lỗi khi nạp cấu hình mặc định!');
      }
    });
  }

  // Check active tab site status
  async function checkActiveTabStatus() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.startsWith('http')) return;

      const data = await chrome.storage.local.get('sites');
      const sites = data.sites || {};
      
      let matchedSite = null;
      for (const [key, site] of Object.entries(sites)) {
        const pattern = new RegExp(site.domainPattern, 'i');
        if (pattern.test(tab.url)) {
          matchedSite = site;
          break;
        }
      }

      const notificationArea = document.getElementById('status-notification-area');
      if (!notificationArea) return;

      if (!matchedSite) {
        // Only show if it looks like a manga page to avoid annoying users on google/etc.
        const isLikelyManga = /chapter|chap|truyen|manga|comic|detail/i.test(tab.url);
        if (isLikelyManga) {
          const urlObj = new URL(tab.url);
          const host = urlObj.hostname.replace('www.', '');
          
          notificationArea.innerHTML = `
            <div class="status-alert warning">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-svg"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div class="alert-content">
                <div><strong>Trang chưa được hỗ trợ:</strong> Trang web <code>${host}</code> này chưa được đăng ký trong danh sách cấu hình.</div>
                <button class="status-alert-btn" id="btn-quick-add">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Thêm cấu hình nhanh cho trang này</span>
                </button>
              </div>
            </div>
          `;
          
          document.getElementById('btn-quick-add').addEventListener('click', () => {
            const domainKeywords = host.split('.')[0];
            siteNameInput.value = domainKeywords.charAt(0).toUpperCase() + domainKeywords.slice(1);
            siteDomainInput.value = domainKeywords;
            siteRefererInput.value = urlObj.origin + '/';
            
            // Focus and click the Add Config Tab
            const addTab = document.querySelector('[data-tab="add-site"]');
            if (addTab) addTab.click();
          });
        }
      } else {
        notificationArea.innerHTML = `
          <div class="status-alert" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.25); color: #a7f3d0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div class="alert-content">
              <div><strong>Đã hỗ trợ:</strong> Tiện ích đã nhận dạng và sẵn sàng tải trên trang <code>${matchedSite.name}</code>!</div>
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Search input listener
  const searchInput = document.getElementById('site-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterAndRenderSites();
    });
  }

  // Manga search implementation
  const mangaSearchInput = document.getElementById('manga-search-input');
  const btnMangaSearch = document.getElementById('btn-manga-search');
  const mangaSearchLoading = document.getElementById('manga-search-loading');
  const mangaSearchResults = document.getElementById('manga-search-results');

  async function performMangaSearch() {
    const query = mangaSearchInput.value.trim();
    if (!query) return;

    mangaSearchLoading.style.display = 'block';
    mangaSearchResults.innerHTML = '';

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      mangaSearchLoading.style.display = 'none';
      mangaSearchResults.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Trình duyệt không hỗ trợ tìm kiếm trực tiếp.</div>';
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SEARCH_MANGA',
      data: { query }
    }, (response) => {
      mangaSearchLoading.style.display = 'none';

      if (response && response.success) {
        const results = response.results || [];
        if (results.length === 0) {
          mangaSearchResults.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">
              Không tìm thấy truyện hoặc tác giả nào phù hợp trên các website hỗ trợ.
            </div>
          `;
          return;
        }

        mangaSearchResults.innerHTML = '';
        results.forEach(item => {
          const card = document.createElement('div');
          card.className = 'search-result-card';
          
          card.innerHTML = `
            <img src="${item.thumbnail}" class="search-result-cover" alt="cover" onerror="this.src='../icons/icon48.png'">
            <div class="search-result-info">
              <div class="search-result-title" title="${item.title}">${item.title}</div>
              <div class="search-result-meta">
                <span class="search-result-source ${item.sourceKey}">${item.source}</span>
                <span class="search-result-author" title="${item.author}">${item.author}</span>
              </div>
            </div>
            <button class="btn-icon open-btn search-result-open" data-url="${item.url}" title="Mở truyện">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </button>
          `;

          // Add click event to open button
          card.querySelector('.search-result-open').addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.create({ url: item.url });
          });

          // Also clicking the card itself opens the url
          card.style.cursor = 'pointer';
          card.addEventListener('click', () => {
            chrome.tabs.create({ url: item.url });
          });

          mangaSearchResults.appendChild(card);
        });
      } else {
        const errMsg = response ? response.error : 'Lỗi không xác định';
        mangaSearchResults.innerHTML = `
          <div style="text-align: center; color: var(--color-danger); padding: 20px;">
            Lỗi khi tìm kiếm: ${errMsg}
          </div>
        `;
      }
    });
  }

  if (btnMangaSearch && mangaSearchInput) {
    btnMangaSearch.addEventListener('click', performMangaSearch);
    mangaSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performMangaSearch();
      }
    });
  }

  // Theme Toggle (Sáng/Tối)
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    const sunIcon = themeToggleBtn.querySelector('.icon-sun');
    const moonIcon = themeToggleBtn.querySelector('.icon-moon');

    const applyTheme = (theme) => {
      if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
      } else {
        document.body.classList.remove('light-theme');
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('theme', (data) => {
        applyTheme(data.theme || 'dark');
      });
    } else {
      applyTheme('dark');
    }

    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-theme');
      const newTheme = isLight ? 'dark' : 'light';
      applyTheme(newTheme);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: newTheme });
      }
    });
  }

  // Initial load
  loadSites();
  checkActiveTabStatus();
});
