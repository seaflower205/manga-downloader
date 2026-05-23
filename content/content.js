// Content Script for Manga Downloader Premium

(async function () {
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
      font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
      user-select: none;
    }
    .manga-dl-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 22px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: #ffffff;
      border: none;
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .manga-dl-btn:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 12px 40px rgba(168, 85, 247, 0.5);
    }
    .manga-dl-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .manga-dl-icon {
      font-size: 18px;
    }
    .manga-dl-panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 320px;
      background: rgba(20, 20, 25, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px) saturate(180%);
      color: #ffffff;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
      color: #9ca3af;
      margin-bottom: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .manga-dl-info {
      font-size: 13px;
      background: rgba(255, 255, 255, 0.05);
      padding: 10px 12px;
      border-radius: 10px;
      margin-bottom: 16px;
      border: 1px solid rgba(255, 255, 255, 0.03);
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
      color: #9ca3af;
    }
    .manga-dl-info-value {
      font-weight: 600;
      color: #e5e7eb;
    }
    .manga-dl-start-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .manga-dl-start-btn:hover {
      background: linear-gradient(135deg, #059669, #047857);
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
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
      background: linear-gradient(90deg, #6366f1, #a855f7);
      transition: width 0.3s ease;
    }
    .manga-dl-status-text {
      font-size: 12px;
      color: #a855f7;
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
    // If global chapterImages is defined, return it directly (very robust for sites like mangaball)
    if (typeof chapterImages !== 'undefined' && Array.isArray(chapterImages) && chapterImages.length > 0) {
      return chapterImages;
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
  mainBtn.innerHTML = '<span class="manga-dl-icon">⚡</span> <span>Tải Manga</span>';

  container.appendChild(panel);
  container.appendChild(mainBtn);
  document.body.appendChild(container);

  // Toggle panel visibility
  mainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Refresh page data on open
    const { title, chapter } = getMetadata();
    const images = getImages();

    // Determine target size description
    let targetDesc = `${images.length} ảnh gốc`;
    if (images.length > 30) {
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
      <button class="manga-dl-start-btn" id="manga-dl-action-btn">Tải Chapter Này</button>
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
    actionBtn.addEventListener('click', async () => {
      if (images.length === 0) {
        alert('Không tìm thấy hình ảnh nào để tải! Vui lòng kiểm tra lại cấu trúc trang.');
        return;
      }

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
  });

  // Close panel when clicking outside
  document.addEventListener('click', () => {
    panel.classList.remove('active');
  });

  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

})();
