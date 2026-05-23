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
    const sites = data.sites || {};
    
    sitesContainer.innerHTML = '';
    const keys = Object.keys(sites);
    sitesCount.textContent = keys.length;

    if (keys.length === 0) {
      sitesContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
          Chưa có cấu hình trang nào. Hãy thêm ở tab bên cạnh!
        </div>
      `;
      return;
    }

    keys.forEach(key => {
      const site = sites[key];
      const card = document.createElement('div');
      card.className = 'site-card';
      card.innerHTML = `
        <div class="site-info">
          <h3>${site.name}</h3>
          <p>Mẫu miền: <code>${site.domainPattern}</code></p>
        </div>
        <div class="site-actions">
          <button class="btn-icon edit-btn" data-key="${key}" title="Sửa">✏️</button>
          <button class="btn-icon delete delete-btn" data-key="${key}" title="Xóa">🗑️</button>
        </div>
      `;
      sitesContainer.appendChild(card);
    });

    // Add event listeners to dynamically created edit and delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.target.getAttribute('data-key');
        editSite(key, sites[key]);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.target.getAttribute('data-key');
        deleteSite(key);
      });
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

  // Initial load
  loadSites();
});
