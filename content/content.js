// Content Script for Manga Downloader Premium

(async function () {
  let pageChapterImages = [];
  const BRIDGE_ID = '__manga_dl_bridge__';

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

  // Load site configurations
  const stored = await chrome.storage.local.get('sites');
  if (!stored.sites) return;

  const currentUrl = window.location.href;
  let matchedSite = null;
  let matchedKey = null;

  for (const [key, site] of Object.entries(stored.sites)) {
    const pattern = new RegExp(site.domainPattern, 'i');
    if (pattern.test(currentUrl)) {
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
  `;
  document.head.appendChild(style);

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
    const mergedDataUrl = format === 'image/jpeg'
      ? canvas.toDataURL('image/jpeg', 0.95)
      : canvas.toDataURL('image/png');

    // Free memory
    images.forEach(img => {
      img.src = '';
    });

    return {
      dataUrl: mergedDataUrl,
      ext: format === 'image/jpeg' ? 'jpg' : 'png'
    };
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

  // Set initial state of main button based on images count
  readBridge(); // Check if grabber.js already wrote data
  const initialImages = getImages();
  if (initialImages.length === 0) {
    mainBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> <span>Lỗi cấu trúc trang</span>';
  }

  // Toggle panel visibility
  mainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Refresh page data on open
    const { title, chapter } = getMetadata();
    const images = getImages();

    // Refresh button state dynamically in case images loaded later
    if (images.length === 0) {
      mainBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
      mainBtn.style.color = '#ffffff';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> <span>Lỗi cấu trúc trang</span>';
    } else {
      mainBtn.style.background = '';
      mainBtn.style.color = '';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải Manga</span>';
    }

    // Determine target size description and action button HTML
    let targetDesc = `${images.length} ảnh gốc`;
    let actionBtnHtml = `<button class="manga-dl-start-btn" id="manga-dl-action-btn">Tải Chapter Này</button>`;

    if (images.length === 0) {
      targetDesc = `<span style="color: #ef4444; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 0 ảnh (Lỗi cấu trúc)</span>`;
      actionBtnHtml = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.4; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div><strong>Cấu trúc trang web đã thay đổi!</strong> Không tìm thấy hình ảnh nào bằng bộ lọc hiện tại. Vui lòng kiểm tra hoặc cập nhật lại cấu hình selectors.</div>
        </div>
      `;
    } else if (images.length > 30) {
      const groupSize = Math.ceil(images.length / 20);
      const finalCount = Math.ceil(images.length / groupSize);
      targetDesc = `${images.length} ảnh gốc (sẽ gộp thành ~${finalCount} trang dài)`;
    }

    panel.innerHTML = `
      <div class="manga-dl-title">${title}</div>
      <div class="manga-dl-subtitle">${chapter}</div>
      <div class="manga-dl-info">
        <div class="manga-dl-info-row">
          <span class="manga-dl-info-label">Nguồn:</span>
          <span class="manga-dl-info-value">${matchedSite.name}</span>
        </div>
        <div class="manga-dl-info-row">
          <span class="manga-dl-info-label">Số trang:</span>
          <span class="manga-dl-info-value">${targetDesc}</span>
        </div>
      </div>
      ${actionBtnHtml}
      <div id="manga-dl-progress-container" style="display: none;">
        <div class="manga-dl-progress-bar">
          <div class="manga-dl-progress-fill" id="manga-dl-progress-fill"></div>
        </div>
        <div class="manga-dl-status-text" id="manga-dl-status-text">Đang tải: 0%</div>
      </div>
    `;

    panel.classList.toggle('active');

    // Action listener inside panel
    const actionBtn = panel.querySelector('#manga-dl-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', async () => {
        actionBtn.style.display = 'none';
        const progressContainer = panel.querySelector('#manga-dl-progress-container');
      const progressFill = panel.querySelector('#manga-dl-progress-fill');
      const statusText = panel.querySelector('#manga-dl-status-text');

      progressContainer.style.display = 'block';

      // Decide if we need merging (merge if original slice count is > 30)
      const needMerging = images.length > 30;
      const targetCount = 20; // Target count of final images (10 to 30)
      const groupSize = needMerging ? Math.ceil(images.length / targetCount) : 1;
      const totalGroups = Math.ceil(images.length / groupSize);

      const processedImages = [];
      let successGroups = 0;

      for (let i = 0; i < images.length; i += groupSize) {
        const groupIndex = Math.floor(i / groupSize);
        const groupUrls = images.slice(i, i + groupSize);

        statusText.style.color = '#a855f7';
        statusText.textContent = `Đang tải & xử lý nhóm ${groupIndex + 1}/${totalGroups}...`;
        progressFill.style.width = `${Math.round((groupIndex / totalGroups) * 100)}%`;

        try {
          // Fetch raw data URLs from background script (to bypass referer check and CORS)
          const fetchedResults = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'FETCH_GROUP_DATA',
              data: {
                urls: groupUrls,
                referer: window.location.href
              }
            }, resolve);
          });

          // Check if any fetches succeeded
          const successfulDataUrls = fetchedResults.filter(r => r.success).map(r => r.dataUrl);

          if (successfulDataUrls.length > 0) {
            let finalDataUrl;
            let extension = 'jpg';

            if (needMerging) {
              // Merge images in canvas to JPEG (highest compatibility and visual quality)
              const mergeResult = await mergeImageGroup(successfulDataUrls, 'image/jpeg');
              finalDataUrl = mergeResult.dataUrl;
              extension = mergeResult.ext;
            } else {
              // Convert single WebP to JPEG for better compatibility
              const originalUrl = groupUrls[0];
              const ext = originalUrl.split('.').pop().split(/[?#]/)[0] || 'jpg';
              if (ext.toLowerCase() === 'webp') {
                const mergeResult = await mergeImageGroup(successfulDataUrls, 'image/jpeg');
                finalDataUrl = mergeResult.dataUrl;
                extension = mergeResult.ext;
              } else {
                finalDataUrl = successfulDataUrls[0];
                extension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext.toLowerCase()) ? ext : 'jpg';
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
