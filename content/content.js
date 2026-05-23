// Content Script for Manga Downloader Premium

(async function () {
  let pageChapterImages = [];
  const BRIDGE_ID = '__manga_dl_bridge__';

  // Security: Escape HTML to prevent XSS when inserting into innerHTML
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Security: Validate regex pattern to prevent ReDoS attacks
  function safeRegexTest(pattern, input) {
    try {
      // Only allow simple domain patterns (alphanumeric, dots, backslashes, brackets)
      if (!/^[a-zA-Z0-9.\\\[\]\-_|^$*+?(){}]+$/.test(pattern)) {
        console.warn('Manga Downloader: Rejected unsafe regex pattern:', pattern);
        return false;
      }
      const re = new RegExp(pattern, 'i');
      return re.test(input);
    } catch (e) {
      console.warn('Manga Downloader: Invalid regex pattern:', pattern, e);
      return false;
    }
  }

  // Read data from the DOM bridge element (written by grabber.js in MAIN world)
  function readBridge() {
    const bridge = document.getElementById(BRIDGE_ID);
    if (bridge && bridge.textContent) {
      try {
        const data = JSON.parse(bridge.textContent);
        if (Array.isArray(data) && data.length > 0 && data.length !== pageChapterImages.length) {
          pageChapterImages = data;
          console.log(`Manga Downloader: Intercepted ${pageChapterImages.length} images from page context via DOM bridge.`);
          updateButtonState();
        }
      } catch (e) {
        console.warn('Manga Downloader: Failed to parse bridge data', e);
      }
    }
  }

  // Update UI button dynamically when images are found
  function updateButtonState() {
    const mainBtn = document.querySelector('.manga-dl-btn');
    if (mainBtn && pageChapterImages.length > 0) {
      mainBtn.style.background = ''; // reset to default CSS style
      mainBtn.style.color = '';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải Manga</span>';
    }
  }

  // Watch for the bridge element to appear or change (MutationObserver)
  const observer = new MutationObserver(() => readBridge());
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // Also poll periodically for reliability (some sites have dynamic loading)
  let bridgeChecks = 0;
  const bridgeInterval = setInterval(() => {
    readBridge();
    if (++bridgeChecks > 40 || pageChapterImages.length > 0) {
      clearInterval(bridgeInterval);
      observer.disconnect(); // Stop observing once data is found or timeout
    }
  }, 300);

  // Load site configurations and saved download format
  let savedFormat = 'jpg';
  const stored = await chrome.storage.local.get(['sites', 'downloadFormat']);
  if (!stored.sites) return;
  savedFormat = stored.downloadFormat || 'jpg';

  const currentUrl = window.location.href;
  let matchedSite = null;
  let matchedKey = null;

  for (const [key, site] of Object.entries(stored.sites)) {
    if (safeRegexTest(site.domainPattern, currentUrl)) {
      matchedSite = site;
      matchedKey = key;
      break;
    }
  }

  if (!matchedSite) {
    console.log('Manga Downloader: Current site is not configured.');
    return;
  }

  console.log(`Manga Downloader: Matched site config [${matchedSite.name}]`);

  // Dynamic page initializers for special sites
  async function initializeSpecialSites() {
    const url = window.location.href;
    if (url.includes('mangadex.org')) {
      try {
        const match = window.location.pathname.match(/\/chapter\/([a-f0-9-]+)/);
        const chapterId = match ? match[1] : null;
        if (chapterId) {
          console.log("Manga Downloader: Querying MangaDex API for chapter:", chapterId);
          const res = await fetch('https://api.mangadex.org/at-home/server/' + chapterId);
          const json = await res.json();
          const baseUrl = json.baseUrl;
          const hash = json.chapter.hash;
          const filenames = json.chapter.data;
          pageChapterImages = filenames.map(fn => `${baseUrl}/data/${hash}/${fn}`);
          console.log(`Manga Downloader: Loaded ${pageChapterImages.length} images from MangaDex API.`);
          updateButtonState();
        }
      } catch (e) {
        console.warn("Manga Downloader: Failed to load MangaDex API images:", e);
      }
    }
  }
  initializeSpecialSites();

  // Inject styles for the premium UI
  const style = document.createElement('style');
  style.textContent = `
    .manga-dl-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: 'Outfit', 'Noto Sans JP', sans-serif;
      user-select: none;
    }
    .manga-dl-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 22px;
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      backdrop-filter: blur(8px);
    }
    .manga-dl-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 12px 40px rgba(37, 99, 235, 0.55);
      filter: brightness(1.1);
    }
    .manga-dl-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .manga-dl-icon {
      display: flex;
      align-items: center;
    }
    .manga-dl-panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 320px;
      background: radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.15) 0%, rgba(8, 8, 12, 0.96) 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 22px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #ffffff;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .manga-dl-panel.active {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    .manga-dl-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 6px;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .manga-dl-subtitle {
      font-size: 12px;
      color: #94A3B8;
      margin-bottom: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .manga-dl-info {
      font-size: 13px;
      background: rgba(255, 255, 255, 0.03);
      padding: 10px 12px;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .manga-dl-info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .manga-dl-info-row:last-child {
      margin-bottom: 0;
    }
    .manga-dl-info-label {
      color: #94A3B8;
    }
    .manga-dl-info-value {
      font-weight: 600;
      color: #e2e8f0;
    }
    .manga-dl-start-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }
    .manga-dl-start-btn:hover {
      transform: translateY(-1.5px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
      filter: brightness(1.1);
    }
    .manga-dl-progress-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 12px;
    }
    .manga-dl-progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #3B82F6, #F97316);
      transition: width 0.3s ease;
    }
    .manga-dl-status-text {
      font-size: 12px;
      color: #3B82F6;
      font-weight: 600;
      text-align: center;
      margin-top: 8px;
    }
    .manga-dl-format-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      margin-bottom: 8px;
    }
    .manga-dl-format-label {
      color: #94A3B8;
      font-size: 13px;
    }
    .manga-dl-format-select {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      border-radius: 8px;
      padding: 4px 8px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      outline: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .manga-dl-format-select:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .manga-dl-format-select:focus {
      border-color: #3B82F6;
    }
    .manga-dl-format-select option {
      background: #111827;
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);

  // Helper to fetch blob URL and convert to Data URL (Base64)
  async function fetchBlobAsDataUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  }

  // Helper to load image from data URL
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load image: ' + e.message));
      img.src = dataUrl;
    });
  }

  // Merge group of image objects vertically using canvas
  async function mergeImageGroup(dataUrls, format = 'image/jpeg') {
    if (dataUrls.length === 0) return null;

    const images = await Promise.all(dataUrls.map(url => loadImage(url)));

    let maxWidth = 0;
    let totalHeight = 0;
    images.forEach(img => {
      if (img.naturalWidth > maxWidth) maxWidth = img.naturalWidth;
      totalHeight += img.naturalHeight;
    });

    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    // Fill white background for JPEG
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let currentY = 0;
    images.forEach(img => {
      ctx.drawImage(img, 0, currentY, maxWidth, img.naturalHeight);
      currentY += img.naturalHeight;
    });

    // Export as high quality
    let mergedDataUrl;
    if (format === 'image/jpeg') {
      mergedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    } else if (format === 'image/webp') {
      mergedDataUrl = canvas.toDataURL('image/webp', 0.92);
    } else {
      mergedDataUrl = canvas.toDataURL('image/png');
    }

    // Free memory
    images.forEach(img => {
      img.src = '';
    });

    return mergedDataUrl;
  }

  // Scrape page helper
  function getMetadata() {
    const titleEl = document.querySelector(matchedSite.titleSelector);
    const chapterEl = document.querySelector(matchedSite.chapterSelector);
    
    let title = titleEl ? titleEl.textContent.trim() : document.title.split('-')[0].trim();
    let chapter = chapterEl ? chapterEl.textContent.trim() : 'Chapter';

    // Clean title and chapter names for folder names
    title = title.replace(/[\\\\/:*?\"<>|]/g, '').trim();
    chapter = chapter.replace(/[\\\\/:*?\"<>|]/g, '').trim();

    return { title, chapter };
  }

  function getImages() {
    // If we intercepted the chapterImages from the main world, return it directly (very robust for sites like mangaball)
    if (pageChapterImages && pageChapterImages.length > 0) {
      return pageChapterImages;
    }

    const images = [];
    const selectors = matchedSite.imageSelector.split(',');
    const attributes = (matchedSite.imageUrlAttribute || 'src').split('|');

    selectors.forEach(sel => {
      document.querySelectorAll(sel.trim()).forEach(img => {
        let src = '';
        for (const attr of attributes) {
          const val = img.getAttribute(attr.trim());
          if (val && val.trim().startsWith('http')) {
            src = val.trim();
            break;
          } else if (val && val.trim().startsWith('//')) {
            src = window.location.protocol + val.trim();
            break;
          }
        }
        
        // Fallback to standard src
        if (!src && img.src && img.src.startsWith('http')) {
          src = img.src;
        }

        if (src && !images.includes(src)) {
          images.push(src);
        }
      });
    });

    return images;
  }

  // Create UI elements
  const container = document.createElement('div');
  container.className = 'manga-dl-container';

  const panel = document.createElement('div');
  panel.className = 'manga-dl-panel';

  const mainBtn = document.createElement('button');
  mainBtn.className = 'manga-dl-btn';
  mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải Manga</span>';

  container.appendChild(panel);
  container.appendChild(mainBtn);
  document.body.appendChild(container);

  function isChapterPage() {
    if (!matchedSite) return false;
    if (!matchedSite.chapterUrlPattern) return true;
    return safeRegexTest(matchedSite.chapterUrlPattern, window.location.href);
  }

  // Set initial state of main button based on images count
  readBridge(); // Check if grabber.js already wrote data
  const initialImages = getImages();
  if (initialImages.length === 0) {
    if (isChapterPage()) {
      mainBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
      mainBtn.style.color = '#ffffff';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> <span>Lỗi cấu trúc trang</span>';
    } else {
      mainBtn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
      mainBtn.style.color = '#ffffff';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> <span>Mở chương để tải</span>';
    }
  }

  // Toggle panel visibility
  mainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Refresh page data on open
    const { title, chapter } = getMetadata();
    const images = getImages();

    // Refresh button state dynamically in case images loaded later
    let totalPages = 0;
    if (window.location.hostname.includes('mangaplaza')) {
      const captionEl = document.querySelector('#menu_cnt_left');
      if (captionEl) {
        const match = captionEl.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          totalPages = parseInt(match[2], 10);
        }
      }
    }

    const hasContent = images.length > 0 || totalPages > 0;
    if (!hasContent) {
      if (isChapterPage()) {
        mainBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
        mainBtn.style.color = '#ffffff';
        mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> <span>Lỗi cấu trúc trang</span>';
      } else {
        mainBtn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
        mainBtn.style.color = '#ffffff';
        mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> <span>Mở chương để tải</span>';
      }
    } else {
      mainBtn.style.background = '';
      mainBtn.style.color = '';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải Manga</span>';
    }

    // Determine target size description and action button HTML
    let targetDesc = `${images.length} ảnh gốc`;
    if (totalPages > 0) {
      targetDesc = `${totalPages} trang (đọc từ MangaPlaza Speedreader)`;
    } else if (images.length > 30) {
      const groupSize = Math.ceil(images.length / 20);
      const finalCount = Math.ceil(images.length / groupSize);
      targetDesc = `${images.length} ảnh gốc (sẽ gộp thành ~${finalCount} trang dài)`;
    }

    let actionBtnHtml = `<button class="manga-dl-start-btn" id="manga-dl-action-btn">Tải Chapter Này</button>`;

    if (!hasContent) {
      if (isChapterPage()) {
        actionBtnHtml = `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.4; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div><strong>Cấu trúc trang web đã thay đổi!</strong> Không tìm thấy hình ảnh nào bằng bộ lọc hiện tại. Vui lòng kiểm tra hoặc cập nhật lại cấu hình selectors.</div>
          </div>
        `;
      } else {
        actionBtnHtml = `
          <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.25); color: #93c5fd; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.4; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div><strong>Chưa mở trang đọc truyện!</strong> Vui lòng bấm chọn một chương truyện để có thể tải ảnh về.</div>
          </div>
        `;
      }
    }

    panel.innerHTML = `
      <div class="manga-dl-title">${escapeHtml(title)}</div>
      <div class="manga-dl-subtitle">${escapeHtml(chapter)}</div>
      <div class="manga-dl-info">
        <div class="manga-dl-info-row">
          <span class="manga-dl-info-label">Nguồn:</span>
          <span class="manga-dl-info-value">${escapeHtml(matchedSite.name)}</span>
        </div>
        <div class="manga-dl-info-row">
          <span class="manga-dl-info-label">Số trang:</span>
          <span class="manga-dl-info-value">${targetDesc}</span>
        </div>
        ${images.length > 0 ? `
        <div class="manga-dl-format-row">
          <span class="manga-dl-format-label">Định dạng tải:</span>
          <select class="manga-dl-format-select" id="manga-dl-format-select">
            <option value="jpg" ${savedFormat === 'jpg' ? 'selected' : ''}>JPG (Đề xuất)</option>
            <option value="jpeg" ${savedFormat === 'jpeg' ? 'selected' : ''}>JPEG</option>
            <option value="png" ${savedFormat === 'png' ? 'selected' : ''}>PNG (Chất lượng cao)</option>
            <option value="webp" ${savedFormat === 'webp' ? 'selected' : ''}>WEBP (Dung lượng nhẹ)</option>
          </select>
        </div>
        ` : ''}
      </div>
      ${actionBtnHtml}
      <div id="manga-dl-progress-container" style="display: none;">
        <div class="manga-dl-progress-bar">
          <div class="manga-dl-progress-fill" id="manga-dl-progress-fill"></div>
        </div>
        <div class="manga-dl-status-text" id="manga-dl-status-text">Đang tải: 0%</div>
      </div>
    `;

    // Save chosen format to local storage
    const formatSelect = panel.querySelector('#manga-dl-format-select');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => {
        savedFormat = e.target.value;
        chrome.storage.local.set({ downloadFormat: savedFormat });
      });
    }

    panel.classList.toggle('active');

    // Action listener inside panel
    const actionBtn = panel.querySelector('#manga-dl-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', async () => {
        const formatSelect = panel.querySelector('#manga-dl-format-select');
        const selectedFormat = formatSelect ? formatSelect.value : 'jpg';

        let mimeFormat = 'image/jpeg';
        if (selectedFormat === 'webp') {
          mimeFormat = 'image/webp';
        } else if (selectedFormat === 'png') {
          mimeFormat = 'image/png';
        }

        const getMimeType = (dataUrl) => {
          const match = dataUrl.match(/^data:([^;]+);/);
          return match ? match[1] : '';
        };

        actionBtn.style.display = 'none';
        const progressContainer = panel.querySelector('#manga-dl-progress-container');
        const progressFill = panel.querySelector('#manga-dl-progress-fill');
        const statusText = panel.querySelector('#manga-dl-status-text');

        progressContainer.style.display = 'block';

        const processedImages = [];
        let successGroups = 0;
        let totalGroups = 0;

        if (window.location.hostname.includes('mangaplaza')) {
          // Special MangaPlaza Speedreader handler
          let totalPages = 0;
          const captionEl = document.querySelector('#menu_cnt_left');
          if (captionEl) {
            const match = captionEl.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
            if (match) {
              totalPages = parseInt(match[2], 10);
            }
          }
          if (totalPages === 0) {
            statusText.style.color = '#ef4444';
            statusText.textContent = `Lỗi! Không lấy được số trang MangaPlaza.`;
            actionBtn.style.display = 'block';
            return;
          }

          totalGroups = totalPages;
          statusText.textContent = `Đang di chuyển về trang 1...`;
          progressFill.style.width = '5%';

          // Navigate back to page 1 using robust navigation
          const getPageNum = () => {
            const el = document.querySelector('#menu_slidercaption') || document.querySelector('#menu_cnt_left');
            if (!el) return null;
            const match = el.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
            return match ? parseInt(match[1], 10) : null;
          };

          let pageNum = getPageNum();
          let prevRetries = 0;
          while (pageNum !== null && pageNum > 1 && prevRetries < 100) {
            const prevPage = pageNum;
            if (typeof window.BBAppPrevPage === 'function') {
              window.BBAppPrevPage();
            } else {
              break;
            }
            
            let changed = false;
            for (let w = 0; w < 15; w++) {
              await new Promise(resolve => setTimeout(resolve, 30));
              pageNum = getPageNum();
              if (pageNum !== null && pageNum < prevPage) {
                changed = true;
                break;
              }
            }
            prevRetries++;
          }

          // Loop to collect all pages slices with robust wait
          const pagesSlices = [];
          for (let p = 1; p <= totalPages; p++) {
            statusText.style.color = '#3B82F6';
            statusText.textContent = `Đang thu thập trang ${p}/${totalPages}...`;
            progressFill.style.width = `${Math.round((p / totalPages) * 40) + 5}%`; // max 45%

            // Wait for #content-p{p} .pt-img to be loaded and have images
            let ptImg = null;
            let waitRetries = 0;
            while (waitRetries < 30) {
              const container = document.querySelector(`#content-p${p}`);
              if (container) {
                ptImg = container.querySelector('.pt-img');
                if (ptImg && ptImg.querySelectorAll('img').length > 0) {
                  break;
                }
              }
              await new Promise(resolve => setTimeout(resolve, 100));
              waitRetries++;
            }

            if (!ptImg) {
              console.warn(`Manga Downloader: Failed to load pt-img for page ${p}`);
              pagesSlices.push([]);
            } else {
              const imgSlices = Array.from(ptImg.querySelectorAll('img')).map(img => {
                const div = img.parentElement;
                const style = div.style.cssText || div.getAttribute('style') || '';
                const insetMatch = style.match(/inset:\s*([\d.-]+)%/);
                let topPercent = 0;
                if (insetMatch) {
                  topPercent = parseFloat(insetMatch[1]);
                } else {
                  const topMatch = style.match(/top:\s*([\d.-]+)%/);
                  if (topMatch) {
                    topPercent = parseFloat(topMatch[1]);
                  }
                }
                return { src: img.src, topPercent };
              });
              // Sort by topPercent
              imgSlices.sort((a, b) => a.topPercent - b.topPercent);
              pagesSlices.push(imgSlices.map(s => s.src));
            }

            // Move to next page and wait for the page number to increment
            if (p < totalPages) {
              const prevPage = p;
              if (typeof window.BBAppNextPage === 'function') {
                window.BBAppNextPage();
              }
              
              let changed = false;
              for (let w = 0; w < 20; w++) {
                await new Promise(resolve => setTimeout(resolve, 50));
                const currentPage = getPageNum();
                if (currentPage !== null && currentPage > prevPage) {
                  changed = true;
                  break;
                }
              }
              if (!changed) {
                console.warn(`Manga Downloader: Page navigation timed out at page ${p}`);
              }
            }
          }

          // Download and merge slices for each page
          for (let pIdx = 0; pIdx < totalPages; pIdx++) {
            const pageNum = pIdx + 1;
            statusText.style.color = '#a855f7';
            statusText.textContent = `Đang tải & ghép trang ${pageNum}/${totalPages}...`;
            progressFill.style.width = `${Math.round((pIdx / totalPages) * 50) + 45}%`; // 45% to 95%

            const sliceUrls = pagesSlices[pIdx];
            if (!sliceUrls || sliceUrls.length === 0) {
              console.error(`Page ${pageNum} has no slices`);
              continue;
            }

            try {
              // Fetch slices as data URLs in content script context
              const sliceDataUrls = [];
              for (const sliceUrl of sliceUrls) {
                const dataUrl = await fetchBlobAsDataUrl(sliceUrl);
                sliceDataUrls.push(dataUrl);
              }

              // Merge slices vertically
              const mergedDataUrl = await mergeImageGroup(sliceDataUrls, mimeFormat);
              if (mergedDataUrl) {
                processedImages.push({
                  filename: `${String(pageNum).padStart(3, '0')}.${selectedFormat}`,
                  dataUrl: mergedDataUrl
                });
                successGroups++;
              }
            } catch (err) {
              console.error(`Error processing MangaPlaza page ${pageNum}:`, err);
            }
          }

        } else {
          // Standard download handler (including MangaDex)
          const needMerging = images.length > 30 && !window.location.hostname.includes('mangadex.org');
          const targetCount = 20;
          const groupSize = needMerging ? Math.ceil(images.length / targetCount) : 1;
          totalGroups = Math.ceil(images.length / groupSize);

          for (let i = 0; i < images.length; i += groupSize) {
            const groupIndex = Math.floor(i / groupSize);
            const groupUrls = images.slice(i, i + groupSize);

            statusText.style.color = '#a855f7';
            statusText.textContent = `Đang tải & xử lý nhóm ${groupIndex + 1}/${totalGroups}...`;
            progressFill.style.width = `${Math.round((groupIndex / totalGroups) * 90) + 5}%`;

            try {
              const fetchedResults = await Promise.all(groupUrls.map(async (url) => {
                if (url.startsWith('blob:')) {
                  try {
                    const dataUrl = await fetchBlobAsDataUrl(url);
                    return { success: true, dataUrl };
                  } catch (e) {
                    console.error('Failed to fetch blob URL:', url, e);
                    return { success: false };
                  }
                } else {
                  // Try direct fetch in content script first (bypasses CORS/Referer issues on many CDNs)
                  try {
                    const dataUrl = await fetchBlobAsDataUrl(url);
                    return { success: true, dataUrl };
                  } catch (e) {
                    console.warn('Direct fetch in content script failed, falling back to background:', url, e);
                    // Fallback to background script
                    return new Promise((resolve) => {
                      chrome.runtime.sendMessage({
                        type: 'FETCH_GROUP_DATA',
                        data: {
                          urls: [url],
                          referer: window.location.href
                        }
                      }, (results) => {
                        if (results && results[0] && results[0].success) {
                          resolve({ success: true, dataUrl: results[0].dataUrl });
                        } else {
                          resolve({ success: false });
                        }
                      });
                    });
                  }
                }
              }));

              const successfulDataUrls = fetchedResults.filter(r => r.success).map(r => r.dataUrl);

              if (successfulDataUrls.length > 0) {
                let finalDataUrl;
                let extension = selectedFormat;

                if (needMerging) {
                  finalDataUrl = await mergeImageGroup(successfulDataUrls, mimeFormat);
                } else {
                  const originalDataUrl = successfulDataUrls[0];
                  const originalMime = getMimeType(originalDataUrl);

                  if (originalMime === mimeFormat) {
                    finalDataUrl = originalDataUrl;
                  } else {
                    finalDataUrl = await mergeImageGroup(successfulDataUrls, mimeFormat);
                  }
                }

                if (finalDataUrl) {
                  const paddedIndex = String(groupIndex + 1).padStart(3, '0');
                  processedImages.push({
                    filename: `${paddedIndex}.${extension}`,
                    dataUrl: finalDataUrl
                  });
                  successGroups++;
                }
              }
            } catch (err) {
              console.error(`Error processing group ${groupIndex + 1}:`, err);
            }
          }
        }

      if (processedImages.length === 0) {
        statusText.style.color = '#ef4444';
        statusText.textContent = `Lỗi! Không tải được ảnh nào.`;
        actionBtn.style.display = 'block';
        return;
      }

      // Send to background to compress into ZIP
      statusText.textContent = `Đang đóng gói file ZIP...`;
      progressFill.style.width = '95%';

      chrome.runtime.sendMessage({
        type: 'SAVE_ZIP_DOWNLOAD',
        data: {
          images: processedImages,
          title,
          chapter
        }
      }, (response) => {
        if (response && response.success) {
          progressFill.style.width = '100%';
          statusText.style.color = '#10b981';
          statusText.textContent = `Thành công! Đã lưu file ZIP (${successGroups}/${totalGroups} trang).`;
          setTimeout(() => {
            panel.classList.remove('active');
          }, 3500);
        } else {
          statusText.style.color = '#ef4444';
          statusText.textContent = `Lỗi đóng gói: ${response ? response.error : 'Không rõ nguyên nhân'}`;
          actionBtn.style.display = 'block';
        }
      });
    });
  }
});

  // Close panel when clicking outside
  document.addEventListener('click', () => {
    panel.classList.remove('active');
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

})();
