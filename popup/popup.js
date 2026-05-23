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
        ? `<button class="btn-icon open-btn launch-btn" data-url="${openUrl}" title="Mở nhanh trang web: ${openUrl}">🚀</button>`
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
          <button class="btn-icon edit-btn" data-key="${key}" title="Sửa">✏️</button>
          <button class="btn-icon delete delete-btn" data-key="${key}" title="Xóa">🗑️</button>
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
    syncBtn.addEventListener('click', () => {
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Syncing...';
      
      chrome.runtime.sendMessage({ type: 'TRIGGER_GITHUB_SYNC' }, (response) => {
        syncBtn.disabled = false;
        syncBtn.textContent = '☁️ Sync GitHub';
        
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
              <div><strong>⚠️ Trang chưa được hỗ trợ:</strong> Trang web <code>${host}</code> này chưa được đăng ký trong danh sách cấu hình.</div>
              <button class="status-alert-btn" id="btn-quick-add">➕ Thêm cấu hình nhanh cho trang này</button>
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
            <div><strong>✅ Đã hỗ trợ:</strong> Extension đã nhận dạng trang <code>${matchedSite.name}</code>!</div>
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

  // Initial load
  loadSites();
  checkActiveTabStatus();
});
