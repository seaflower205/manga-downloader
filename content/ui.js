// Content Script User Interface (Panel and Lightbox) Module
(function (root) {
  'use strict';

  const Security = root.MangaSecurity || {};
  const Downloader = root.MangaDownloader || {};
  const Detector = root.MangaDetector || {};

  let panel = null;
  let mainBtn = null;
  let savedFormat = 'jpg';
  let currentTheme = 'dark';

  function getSharedState() {
    if (!root.MangaSharedState) {
      root.MangaSharedState = {
        pageChapterImages: [],
        matchedSite: null,
        matchedKey: null,
        canvasCache: {},
        isScrolling: false,
        hasAutoScrolled: false
      };
    }
    return root.MangaSharedState;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Set button to error state
  function setButtonError() {
    if (!mainBtn) return;
    mainBtn.style.background = 'linear-gradient(135deg, #f59e0b, #ef4444)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> <span>Lỗi cấu trúc trang</span>';
  }

  // Set button to "not a chapter page" state
  function setButtonNotChapter() {
    if (!mainBtn) return;
    mainBtn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> <span>Mở chương để tải</span>';
  }

  // Set button to loading/waiting state
  function setButtonLoading() {
    if (!mainBtn) return;
    mainBtn.style.background = 'linear-gradient(135deg, #3B82F6, #8B5CF6)';
    mainBtn.style.color = '#ffffff';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg class="spinning" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg></span> <span>Đang tải trang...</span>';
  }

  function updateButtonState() {
    if (!mainBtn) return;
    const images = Downloader.getImages();
    
    if (images.length === 0) {
      if (Downloader.isChapterPage()) {
        setButtonError();
      } else {
        setButtonNotChapter();
      }
    } else {
      mainBtn.style.background = '';
      mainBtn.style.color = '';
      mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải truyện tranh</span>';
    }
  }

  function detectImageFormat(urlOrDataUrl, fallbackUrl = '') {
    if (!urlOrDataUrl) return 'Không xác định';

    const formatName = (ext) => {
      if (!ext) return '';
      const clean = ext.trim().toLowerCase();
      if (clean === 'jpeg' || clean === 'jpg') return 'JPG';
      if (clean === 'png') return 'PNG';
      if (clean === 'webp') return 'WEBP';
      if (clean === 'gif') return 'GIF';
      if (clean.length > 0 && clean.length <= 4 && /^[a-z0-9]+$/.test(clean)) {
        return clean.toUpperCase();
      }
      return '';
    };

    if (urlOrDataUrl.startsWith('data:')) {
      const match = urlOrDataUrl.match(/^data:([^;]+);/);
      if (match) {
        const mime = match[1].toLowerCase();
        if (mime.startsWith('image/')) {
          const fmt = mime.substring(6); // e.g. 'png', 'jpeg', 'webp'
          const detected = formatName(fmt);
          if (detected) return detected;
        }
      }
      if (fallbackUrl) {
        return detectImageFormat(fallbackUrl);
      }
      return 'JPG';
    }

    try {
      const urlWithoutQuery = urlOrDataUrl.split(/[#?]/)[0];
      const parts = urlWithoutQuery.split('.');
      if (parts.length > 1) {
        const ext = parts.pop();
        const detected = formatName(ext);
        if (detected) return detected;
      }
    } catch (e) {}
    
    return 'JPG';
  }

  async function getSampleImage() {
    const imgs = Downloader.getImages();
    if (imgs.length > 0) {
      return { type: 'single', url: imgs[0] };
    }
    return null;
  }

  async function updatePreview() {
    if (!panel) return;
    const previewContainer = panel.querySelector('#manga-dl-preview-container');
    const previewImg = panel.querySelector('#manga-dl-preview-thumbnail');
    const previewSizeText = panel.querySelector('#manga-dl-preview-size');
    const previewTotalSizeText = panel.querySelector('#manga-dl-preview-total-size');

    if (!previewContainer) return;
    const selectedFormat = savedFormat;

    let mimeFormat = 'image/jpeg';
    if (selectedFormat === 'webp') mimeFormat = 'image/webp';
    else if (selectedFormat === 'png') mimeFormat = 'image/png';

    if (previewSizeText) previewSizeText.textContent = 'Đang tính toán...';
    if (previewTotalSizeText) previewTotalSizeText.textContent = 'Đang tải ảnh mẫu...';

    try {
      const sample = await getSampleImage();
      if (!sample) {
        previewContainer.style.display = 'none';
        return;
      }

      previewContainer.style.display = 'block';

      let originalFormat = 'Không xác định';
      let mergedUrl = '';
      if (sample.type === 'merged') {
        mergedUrl = await Downloader.mergeImageGroup(sample.urls, mimeFormat);
        if (sample.urls && sample.urls.length > 0) {
          originalFormat = detectImageFormat(sample.urls[0]);
        }
      } else {
        const dataUrl = await Downloader.fetchImageAsDataUrlSafe(sample.url);
        originalFormat = detectImageFormat(dataUrl, sample.url);
        mergedUrl = await Downloader.mergeImageGroup([dataUrl], mimeFormat);
      }

      if (mergedUrl) {
        if (previewImg) {
          previewImg.classList.remove('loaded');
          const imgContainer = panel.querySelector('#manga-dl-preview-img-container');
          if (imgContainer) imgContainer.classList.add('loading');
          
          previewImg.onload = () => {
            previewImg.classList.add('loaded');
            if (imgContainer) imgContainer.classList.remove('loading');
          };
          previewImg.src = mergedUrl;
        }
        
        const origVal = panel.querySelector('#manga-dl-original-format-val');
        if (origVal) {
          origVal.textContent = originalFormat;
        }

        const imgObj = new Image();
        imgObj.onload = () => {
          const dimsVal = panel.querySelector('#manga-dl-dimensions-val');
          if (dimsVal) {
            dimsVal.textContent = `${imgObj.naturalWidth} x ${imgObj.naturalHeight} px`;
          }
        };
        imgObj.src = mergedUrl;
        
        const base64Str = mergedUrl.split(',')[1];
        const bytes = Math.floor(base64Str.length * 0.75);
        
        let sizeStr = '';
        if (bytes > 1024 * 1024) sizeStr = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        else sizeStr = `${(bytes / 1024).toFixed(1)} KB`;
        
        if (previewSizeText) {
          previewSizeText.innerHTML = `<span style="color: #60A5FA;">${selectedFormat.toUpperCase()}</span>: <strong>${sizeStr}</strong>`;
        }

        const totalPages = Downloader.getImages().length;
        const totalBytes = bytes * totalPages;
        let totalSizeStr = '';
        if (totalBytes > 1024 * 1024) totalSizeStr = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
        else totalSizeStr = `${(totalBytes / 1024).toFixed(0)} KB`;

        if (previewTotalSizeText) {
          previewTotalSizeText.textContent = `Ước tính cả chương (${totalPages} trang): ~${totalSizeStr}`;
        }
      }
    } catch (err) {
      console.error('Manga Downloader: Preview failed', err);
      if (previewSizeText) previewSizeText.textContent = 'Lỗi tải ảnh mẫu';
      if (previewTotalSizeText) previewTotalSizeText.textContent = 'Vui lòng thử lại';
      const imgContainer = panel.querySelector('#manga-dl-preview-img-container');
      if (imgContainer) imgContainer.classList.remove('loading');
    }
  }
  let activeLightboxIndex = 0;
  
  function showLightbox(initialIndex) {
    const urls = Downloader.getImages();
    if (!urls || urls.length === 0) return;
    
    activeLightboxIndex = initialIndex;
    
    let lightbox = document.getElementById('manga-dl-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'manga-dl-lightbox';
      lightbox.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(8, 8, 12, 0.98);
        z-index: 10000000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        user-select: none;
        font-family: 'Outfit', sans-serif;
      `;
      
      lightbox.innerHTML = `
        <!-- Header Bar -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 60px; background: linear-gradient(180deg, rgba(8,8,12,0.85) 0%, rgba(8,8,12,0) 100%); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; z-index: 10; pointer-events: none;">
          <div id="manga-dl-lightbox-counter" style="color: #cbd5e1; font-size: 14px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.5); pointer-events: auto;">Trang 1 / 1</div>
          <button id="manga-dl-lightbox-close" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; transition: all 0.2s; pointer-events: auto; backdrop-filter: blur(10px);">&times;</button>
        </div>
        
        <!-- Prev Button -->
        <button id="manga-dl-lightbox-prev" style="position: absolute; left: 24px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #ffffff; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; transition: all 0.2s; z-index: 10; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(0,0,0,0.35);">&#10094;</button>
        
        <!-- Image Container -->
        <div id="manga-dl-lightbox-img-wrap" style="position: relative; display: flex; align-items: center; justify-content: center; max-width: 90%; max-height: 85%; overflow: auto; border-radius: 8px;">
          <div id="manga-dl-lightbox-spinner" style="position: absolute; border: 3px solid rgba(255,255,255,0.1); border-radius: 50%; border-top: 3px solid #3B82F6; width: 40px; height: 40px; animation: spin-manga-dl 0.8s linear infinite; display: none;"></div>
          <img id="manga-dl-lightbox-img" src="" alt="Manga Page" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(59, 130, 246, 0.1); border: 1px solid rgba(255,255,255,0.08); cursor: zoom-in; transition: opacity 0.2s ease, transform 0.2s ease;">
        </div>
        
        <!-- Next Button -->
        <button id="manga-dl-lightbox-next" style="position: absolute; right: 24px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #ffffff; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer; transition: all 0.2s; z-index: 10; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(0,0,0,0.35);">&#10095;</button>
        
        <style>
          @keyframes spin-manga-dl {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          #manga-dl-lightbox-close:hover {
            background: rgba(255,255,255,0.15);
            border-color: rgba(255,255,255,0.3);
            transform: scale(1.05);
          }
          #manga-dl-lightbox-close:active, #manga-dl-lightbox-prev:active, #manga-dl-lightbox-next:active {
            transform: scale(0.95);
          }
          #manga-dl-lightbox-prev:hover, #manga-dl-lightbox-next:hover {
            background: rgba(255,255,255,0.15);
            border-color: rgba(255,255,255,0.3);
            transform: translateY(-50%) scale(1.05);
          }
          #manga-dl-lightbox-prev:disabled, #manga-dl-lightbox-next:disabled {
            opacity: 0.25;
            cursor: not-allowed;
            pointer-events: none;
          }
        </style>
      `;
      document.body.appendChild(lightbox);
      
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === document.getElementById('manga-dl-lightbox-img-wrap')) {
          closeLightbox();
        }
      });
      
      document.getElementById('manga-dl-lightbox-close').addEventListener('click', closeLightbox);
      document.getElementById('manga-dl-lightbox-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        navigateLightbox(-1);
      });
      document.getElementById('manga-dl-lightbox-next').addEventListener('click', (e) => {
        e.stopPropagation();
        navigateLightbox(1);
      });
      document.getElementById('manga-dl-lightbox-img').addEventListener('click', (e) => {
        e.stopPropagation();
        const img = e.target;
        const wrap = document.getElementById('manga-dl-lightbox-img-wrap');
        if (img.classList.contains('zoomed')) {
          img.classList.remove('zoomed');
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          img.style.width = '';
          img.style.height = '';
          img.style.cursor = 'zoom-in';
          if (wrap) wrap.style.alignItems = 'center';
        } else {
          img.classList.add('zoomed');
          img.style.maxWidth = '800px';
          img.style.width = '100%';
          img.style.height = 'auto';
          img.style.maxHeight = 'none';
          img.style.cursor = 'zoom-out';
          if (wrap) {
            wrap.style.alignItems = 'flex-start';
            wrap.scrollTop = 0;
          }
        }
      });
      
      window.addEventListener('keydown', handleLightboxKeydown);
    }
    
    lightbox.style.opacity = '1';
    lightbox.style.pointerEvents = 'auto';
    updateLightboxContent();
  }
  
  function closeLightbox() {
    const lightbox = document.getElementById('manga-dl-lightbox');
    if (lightbox) {
      lightbox.style.opacity = '0';
      lightbox.style.pointerEvents = 'none';
    }
  }
  
  function handleLightboxKeydown(e) {
    const lightbox = document.getElementById('manga-dl-lightbox');
    if (!lightbox || lightbox.style.opacity === '0') return;
    
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
      navigateLightbox(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      navigateLightbox(1);
    } else if (e.key === 'Escape' || e.key === 'Esc') {
      closeLightbox();
    }
  }
  
  function navigateLightbox(direction) {
    const urls = Downloader.getImages();
    if (!urls || urls.length === 0) return;
    
    let newIndex = activeLightboxIndex + direction;
    if (newIndex < 0) newIndex = urls.length - 1;
    if (newIndex >= urls.length) newIndex = 0;
    
    activeLightboxIndex = newIndex;
    updateLightboxContent();
  }
  
  function resetLightboxZoom() {
    const img = document.getElementById('manga-dl-lightbox-img');
    const wrap = document.getElementById('manga-dl-lightbox-img-wrap');
    if (img) {
      img.classList.remove('zoomed');
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.width = '';
      img.style.height = '';
      img.style.cursor = 'zoom-in';
    }
    if (wrap) {
      wrap.style.alignItems = 'center';
      wrap.scrollTop = 0;
    }
  }

  function updateLightboxContent() {
    resetLightboxZoom();
    const urls = Downloader.getImages();
    if (!urls || urls.length === 0) return;
    
    const img = document.getElementById('manga-dl-lightbox-img');
    const counter = document.getElementById('manga-dl-lightbox-counter');
    const spinner = document.getElementById('manga-dl-lightbox-spinner');
    
    if (!img) return;
    
    const url = urls[activeLightboxIndex];
    if (spinner) spinner.style.display = 'block';
    img.style.opacity = '0.5';
    
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = url;
      img.style.opacity = '1';
      if (spinner) spinner.style.display = 'none';
    };
    tempImg.onerror = () => {
      img.src = url;
      img.style.opacity = '1';
      if (spinner) spinner.style.display = 'none';
    };
    tempImg.src = url;
    
    if (counter) {
      counter.textContent = `Trang ${activeLightboxIndex + 1} / ${urls.length}`;
    }
  }

  // Build Scrapers Panel DOM
  async function createPanelUI(site, key) {
    const state = getSharedState();
    state.matchedSite = site;
    state.matchedKey = key;

    // Load preferences from storage before rendering to prevent race conditions
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const data = await chrome.storage.local.get(['downloadFormat', 'theme']);
        if (data.downloadFormat) {
          savedFormat = data.downloadFormat;
        }
        if (data.theme) {
          currentTheme = data.theme;
        }
      } catch (err) {
        console.warn('Manga Downloader: Failed to load preferences:', err);
      }
    }

    const container = document.createElement('div');
    container.className = 'manga-dl-container';

    panel = document.createElement('div');
    panel.className = 'manga-dl-panel';
    if (currentTheme && currentTheme !== 'dark') {
      panel.classList.add(`${currentTheme}-theme`);
    }

    mainBtn = document.createElement('button');
    mainBtn.className = 'manga-dl-btn';
    mainBtn.innerHTML = '<span class="manga-dl-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> <span>Tải truyện tranh</span>';

    container.appendChild(panel);
    container.appendChild(mainBtn);
    document.body.appendChild(container);

    updateButtonState();

    // Toggle panel visibility
    mainBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.isScrolling) return;
      
      if (panel.classList.contains('active')) {
        panel.classList.remove('active');
        return;
      }
      
      const needsScroll = !state.hasAutoScrolled && (
        Downloader.getImages().length === 0 || 
        (state.matchedSite && state.matchedSite.imageSelector.includes('canvas')) ||
        (state.matchedSite && state.matchedSite.name === 'TheBlank') ||
        document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy-src]').length > 0
      );

      if (needsScroll) {
        await Downloader.autoScrollPage();
      }
      
      const images = Downloader.getImages();
      const { title, chapter } = Downloader.getMetadata();
      const hasContent = images.length > 0;

      updateButtonState();

      let targetDesc = `${images.length} ảnh gốc`;
      if (images.length > 30) {
        const groupSize = Math.ceil(images.length / 20);
        const finalCount = Math.ceil(images.length / groupSize);
        targetDesc = `${images.length} ảnh gốc (sẽ gộp thành ~${finalCount} trang dài)`;
      }

      let actionBtnHtml = `<button class="manga-dl-start-btn" id="manga-dl-action-btn">Tải Chapter Này</button>`;

      if (!hasContent) {
        if (Downloader.isChapterPage()) {
          actionBtnHtml = `
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 12px; border-radius: 12px; font-size: 11px; line-height: 1.4; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; box-sizing: border-box;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div><strong>Cấu trúc trang web đã thay đổi!</strong> Không tìm thấy hình ảnh nào bằng bộ lọc hiện tại. Vui lòng kiểm tra hoặc cập nhật lại cấu hình selectors.</div>
              <button class="manga-dl-copy-report-btn" id="manga-dl-copy-report-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Sao chép báo cáo lỗi</span>
              </button>
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
        <button class="manga-dl-close-btn" id="manga-dl-close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="manga-dl-title">${escapeHtml(title)}</div>
        <div class="manga-dl-subtitle">${escapeHtml(chapter)}</div>
        <div class="manga-dl-info">
          <div class="manga-dl-info-row">
            <span class="manga-dl-info-label">Nguồn:</span>
            <span class="manga-dl-info-value">${escapeHtml(site.name)}</span>
          </div>
          <div class="manga-dl-info-row">
            <span class="manga-dl-info-label">Số trang:</span>
            <span class="manga-dl-info-value">${targetDesc}</span>
          </div>
          <div class="manga-dl-info-row" id="manga-dl-original-format-row">
            <span class="manga-dl-info-label">Định dạng gốc:</span>
            <span class="manga-dl-info-value" id="manga-dl-original-format-val">Đang tính...</span>
          </div>
          <div class="manga-dl-info-row" id="manga-dl-dimensions-row">
            <span class="manga-dl-info-label">Kích thước gốc:</span>
            <span class="manga-dl-info-value" id="manga-dl-dimensions-val">Đang tính...</span>
          </div>
          ${hasContent ? `
          <div class="manga-dl-format-row">
            <span class="manga-dl-format-label">Định dạng tải:</span>
            <div class="manga-dl-custom-select" id="manga-dl-custom-select">
              <div class="manga-dl-select-trigger" id="manga-dl-select-trigger">
                <span class="manga-dl-select-trigger-text">${savedFormat.toUpperCase()}</span>
                <svg class="manga-dl-select-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div class="manga-dl-select-options" id="manga-dl-select-options">
                <div class="manga-dl-select-option ${savedFormat === 'jpg' ? 'selected' : ''}" data-value="jpg">
                  <div class="manga-dl-option-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div class="manga-dl-option-text">
                    <div class="manga-dl-option-title">JPG <span class="manga-dl-option-badge badge-recom">Đề xuất</span></div>
                    <div class="manga-dl-option-desc">Tương thích tốt, dung lượng vừa phải.</div>
                  </div>
                  <div class="manga-dl-option-check">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="manga-dl-select-option ${savedFormat === 'jpeg' ? 'selected' : ''}" data-value="jpeg">
                  <div class="manga-dl-option-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div class="manga-dl-option-text">
                    <div class="manga-dl-option-title">JPEG</div>
                    <div class="manga-dl-option-desc">Định dạng ảnh truyền thống phổ biến.</div>
                  </div>
                  <div class="manga-dl-option-check">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="manga-dl-select-option ${savedFormat === 'png' ? 'selected' : ''}" data-value="png">
                  <div class="manga-dl-option-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
                  </div>
                  <div class="manga-dl-option-text">
                    <div class="manga-dl-option-title">PNG <span class="manga-dl-option-badge badge-hq">HQ</span></div>
                    <div class="manga-dl-option-desc">Không nén, giữ nguyên chi tiết sắc nét.</div>
                  </div>
                  <div class="manga-dl-option-check">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="manga-dl-select-option ${savedFormat === 'webp' ? 'selected' : ''}" data-value="webp">
                  <div class="manga-dl-option-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <div class="manga-dl-option-text">
                    <div class="manga-dl-option-title">WEBP <span class="manga-dl-option-badge badge-light">Tối ưu</span></div>
                    <div class="manga-dl-option-desc">Nén hiện đại, dung lượng siêu nhẹ.</div>
                  </div>
                  <div class="manga-dl-option-check">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
        <div class="manga-dl-preview-container" id="manga-dl-preview-container" style="${hasContent ? 'display: block;' : 'display: none;'}">
          <div class="manga-dl-preview-box">
            <div class="manga-dl-preview-img-container loading" id="manga-dl-preview-img-container">
              <img class="manga-dl-preview-thumbnail" id="manga-dl-preview-thumbnail" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Preview">
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(8,8,12,0.7); color: #fff; font-size: 8px; font-weight: bold; text-align: center; padding: 2px 0;">XEM ẢNH</div>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 11px; color: #94A3B8; font-weight: 500; margin-bottom: 2px;">Trang 1:</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px;" id="manga-dl-preview-size">Đang tính...</div>
              <div style="font-size: 11px; color: #60A5FA; font-weight: 600;" id="manga-dl-preview-total-size">Ước tính cả chương: ...</div>
            </div>
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

      // Set up click listener for preview image lightbox
      const previewImgContainer = panel.querySelector('#manga-dl-preview-img-container');
      if (previewImgContainer) {
        previewImgContainer.addEventListener('click', (e) => {
          e.stopPropagation();
          showLightbox(0);
        });
      }

      // Close button listener
      const closeBtn = panel.querySelector('#manga-dl-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          panel.classList.remove('active');
        });
      }

      // Custom select dropdown logic
      const customSelect = panel.querySelector('#manga-dl-custom-select');
      if (customSelect) {
        const selectTrigger = customSelect.querySelector('#manga-dl-select-trigger');
        const optionElements = customSelect.querySelectorAll('.manga-dl-select-option');

        if (selectTrigger) {
          selectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
          });
        }

        optionElements.forEach(option => {
          option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.getAttribute('data-value');
            savedFormat = value;

            optionElements.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            const triggerText = selectTrigger.querySelector('.manga-dl-select-trigger-text');
            if (triggerText) {
              triggerText.textContent = value.toUpperCase();
            }

            chrome.storage.local.set({ downloadFormat: savedFormat });
            updatePreview();
            customSelect.classList.remove('open');
          });
        });
      }

      const copyReportBtn = panel.querySelector('#manga-dl-copy-report-btn');
      if (copyReportBtn) {
        copyReportBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const report = Detector.generateErrorReport('no_images_found');
          navigator.clipboard.writeText(report).then(() => {
            const btnText = copyReportBtn.querySelector('span');
            if (btnText) {
              const originalText = btnText.textContent;
              btnText.textContent = 'Đã sao chép! ✔';
              copyReportBtn.style.background = 'rgba(16, 185, 129, 0.25)';
              copyReportBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
              copyReportBtn.style.color = '#34d399';
              setTimeout(() => {
                btnText.textContent = originalText;
                copyReportBtn.style.background = '';
                copyReportBtn.style.borderColor = '';
                copyReportBtn.style.color = '';
              }, 2000);
            }
          }).catch(err => {
            console.error('Failed to copy report:', err);
            alert('Không thể sao chép báo cáo vào clipboard.');
          });
        });
      }

      // Download Action Trigger
      const actionBtn = panel.querySelector('#manga-dl-action-btn');
      if (actionBtn) {
        actionBtn.addEventListener('click', async () => {
          if (root.MangaUI && root.MangaUI.triggerDownloadFlow) {
            root.MangaUI.triggerDownloadFlow(actionBtn, title, chapter);
          }
        });
      }

      panel.classList.toggle('active');

      if (panel.classList.contains('active')) {
        updatePreview();
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (panel && panel.classList.contains('active')) {
        const path = e.composedPath ? e.composedPath() : [];
        if (!path.includes(panel) && !path.includes(mainBtn)) {
          panel.classList.remove('active');
        }
      }
    });
  }

  // Export to global scope
  root.MangaUI = {
    createPanelUI,
    updateButtonState,
    updatePreview,
    showLightbox,
    getSavedFormat: () => savedFormat,
    setSavedFormat: (val) => { savedFormat = val; },
    getTheme: () => currentTheme,
    setTheme: (val) => { currentTheme = val; }
  };
})(typeof window !== 'undefined' ? window : this);
