// Entry Point and Coordinator for Manga Downloader Content Script
(async function () {
  'use strict';

  const Security = window.MangaSecurity;
  const Detector = window.MangaDetector;
  const Downloader = window.MangaDownloader;
  const UI = window.MangaUI;

  const BRIDGE_ID = '__manga_dl_bridge__';
  let matchedSite = null;
  let matchedKey = null;

  function getSharedState() {
    if (!window.MangaSharedState) {
      window.MangaSharedState = {
        pageChapterImages: [],
        matchedSite: null,
        matchedKey: null,
        canvasCache: {},
        isScrolling: false,
        hasAutoScrolled: false
      };
    }
    return window.MangaSharedState;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Handle Chrome extension message events
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'GET_TAB_HTML') {
      sendResponse({ success: true, html: document.documentElement.outerHTML, url: window.location.href });
      return false;
    }

    if (message && message.type === 'CAPTURE_SANITIZED_DOM') {
      try {
        sendResponse({ success: true, snapshot: Detector.captureSanitizedDomSnapshot() });
      } catch (error) {
        Security.logDiagnostic({ feature: 'capture_sanitized_dom', error }).catch(() => {});
        sendResponse({ success: false, error: Security.sanitizeError(error).message });
      }
      return false;
    }

    if (message && message.type === 'THEME_CHANGED') {
      const newTheme = String(message.theme || 'dark');
      UI.setTheme(newTheme);
      const panelEl = document.querySelector('.manga-dl-panel');
      if (panelEl) {
        panelEl.className = 'manga-dl-panel';
        if (newTheme !== 'dark') panelEl.classList.add(`${newTheme}-theme`);
      }
      sendResponse({ success: true });
      return false;
    }

    if (message && message.type === 'AUTO_DETECT_CONFIG') {
      (async () => {
        try {
          const reportProgress = async (progress, status) => {
            chrome.runtime.sendMessage({ type: 'AUTO_DETECT_PROGRESS', progress, status }).catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 200));
          };

          await reportProgress(15, 'Đang quét bảo mật trang web (Bot Protection)...');
          const botWall = Detector.detectBotWall();
          if (botWall.detected) {
            sendResponse({
              success: false,
              botDetected: true,
              error: `Phát hiện bảo vệ chống bot: ${botWall.type}. Vui lòng tự giải captcha hoặc đợi trang tải đầy đủ rồi thử lại.`
            });
            return;
          }

          await reportProgress(50, 'Đang quét cấu trúc hình ảnh DOM & thuộc tính lazy-load...');
          
          // Probe website images heuristics
          const imgResult = Detector.probeMangaImages();
          if (!imgResult) {
            sendResponse({
              success: false,
              error: 'Không tìm thấy cấu trúc ảnh truyện tranh trên trang này. Vui lòng mở hẳn trang đọc truyện rồi thử lại.'
            });
            return;
          }

          await reportProgress(80, 'Phân tích cấu trúc ảnh thành công. Đang quét metadata truyện...');
          const metaResult = Detector.probeMangaMetadata();
          await reportProgress(100, 'Tự động dò cấu hình hoàn tất!');
          
          const currentHost = window.location.hostname.toLowerCase();
          
          sendResponse({
            success: true,
            experienceMatched: false,
            site: {
              name: document.title.split(/[-|]/)[0].trim(),
              domainPattern: currentHost.replace('www.', '').replace(/\./g, '\\.'),
              imageSelector: imgResult.selector,
              imageUrlAttribute: imgResult.attribute,
              titleSelector: metaResult.titleSelector,
              chapterSelector: metaResult.chapterSelector,
              referer: window.location.origin + '/',
              isNsfw: Detector.detectIsNsfw(),
              searchSupported: false,
              searchUrl: '',
              searchResultSelector: '',
              searchTitleSelector: '',
              searchCoverSelector: '',
              searchAuthorSelector: ''
            },
            stats: {
              imagesFound: imgResult.imageCount,
              titleText: metaResult.titleText,
              chapterText: metaResult.chapterText
            }
          });

        } catch (error) {
          sendResponse({ success: false, error: Security.sanitizeError(error).message });
        }
      })();
      return true; // Keep channel open
    }

    if (message && message.type === 'RUN_SMART_DIAGNOSTICS') {
      (async () => {
        try {
          const state = getSharedState();
          const botWall = Detector.detectBotWall();
          const siteType = Detector.detectSiteType ? Detector.detectSiteType() : null;
          
          const diagnostics = {
            isChapterPage: Downloader.isChapterPage ? Downloader.isChapterPage() : true,
            scrollY: window.scrollY || document.documentElement.scrollTop || 0,
            siteType,
            matchedSite: state.matchedSite ? {
              name: state.matchedSite.name,
              domainPattern: state.matchedSite.domainPattern,
              imageSelector: state.matchedSite.imageSelector,
              imageUrlAttribute: state.matchedSite.imageUrlAttribute,
              titleSelector: state.matchedSite.titleSelector,
              chapterSelector: state.matchedSite.chapterSelector
            } : null,
            botWallDetected: botWall.detected ? botWall.type : null,
            imagesInfo: {
              selectorUsed: state.matchedSite ? state.matchedSite.imageSelector : null,
              elementsFound: 0,
              validUrlsFound: 0,
              sampleImageUrl: '',
              canvasCount: 0,
              canvasCachedCount: Object.keys(state.canvasCache).length,
              lazyLoadedCount: 0,
              emptySrcCount: 0
            },
            metaInfo: {
              titleSelector: state.matchedSite ? state.matchedSite.titleSelector : null,
              titleMatched: false,
              titleText: '',
              chapterSelector: state.matchedSite ? state.matchedSite.chapterSelector : null,
              chapterMatched: false,
              chapterText: ''
            }
          };

          if (state.matchedSite && state.matchedSite.imageSelector) {
            const selectors = state.matchedSite.imageSelector.split(',');
            const attributes = (state.matchedSite.imageUrlAttribute || 'src').split('|');
            const checkedUrls = new Set();

            selectors.forEach(sel => {
              try {
                const nodes = document.querySelectorAll(sel.trim());
                diagnostics.imagesInfo.elementsFound += nodes.length;

                nodes.forEach(node => {
                  if (node.tagName && node.tagName.toLowerCase() === 'canvas') {
                    diagnostics.imagesInfo.canvasCount++;
                  } else {
                    let url = '';
                    for (const attr of attributes) {
                      const val = node.getAttribute(attr.trim());
                      const safeVal = Security.normalizeUrl(val, { baseUrl: window.location.href, allowHttp: true });
                      if (safeVal) {
                        url = safeVal;
                        break;
                      }
                    }
                    if (!url && node.src) {
                      url = Security.normalizeUrl(node.src, { baseUrl: window.location.href, allowHttp: true });
                    }
                    
                    if (url) {
                      checkedUrls.add(url);
                      if (!diagnostics.imagesInfo.sampleImageUrl) {
                        diagnostics.imagesInfo.sampleImageUrl = url;
                      }
                    } else {
                      diagnostics.imagesInfo.emptySrcCount++;
                    }
                  }
                });
              } catch (e) {
                // Ignore selector syntax error
              }
            });
            diagnostics.imagesInfo.validUrlsFound = checkedUrls.size;
          }

          const allImgs = document.querySelectorAll('img');
          allImgs.forEach(img => {
            const hasLazyAttr = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('loading') === 'lazy';
            if (hasLazyAttr && (!img.src || img.src.startsWith('data:') || img.src.includes('placeholder') || (img.complete && img.naturalWidth === 0))) {
              diagnostics.imagesInfo.lazyLoadedCount++;
            }
          });

          if (state.matchedSite) {
            if (state.matchedSite.titleSelector) {
              try {
                const el = document.querySelector(state.matchedSite.titleSelector);
                if (el) {
                  diagnostics.metaInfo.titleMatched = true;
                  diagnostics.metaInfo.titleText = el.textContent.trim();
                }
              } catch (e) {}
            }
            if (state.matchedSite.chapterSelector) {
              try {
                const el = document.querySelector(state.matchedSite.chapterSelector);
                if (el) {
                  diagnostics.metaInfo.chapterMatched = true;
                  diagnostics.metaInfo.chapterText = el.textContent.trim();
                }
              } catch (e) {}
            }
          }

          sendResponse({ success: true, diagnostics });
        } catch (err) {
          sendResponse({ success: false, error: Security.sanitizeError(err).message });
        }
      })();
      return true;
    }
  });

  // Main execution logic on page load
  async function init() {
    try {
      const stored = await chrome.storage.local.get('sites');
      const sites = stored.sites || {};
      const host = window.location.hostname.toLowerCase();

      // Find if current site matches any configured site profiles
      for (const [key, site] of Object.entries(sites)) {
        if (site && site.domainPattern && Security.safeRegexTest(site.domainPattern, host)) {
          matchedSite = site;
          matchedKey = key;
          break;
        }
      }

      if (!matchedSite) return;

      console.log(`Manga Downloader: Matched site config for ${matchedSite.name} (${matchedKey})`);
      
      const state = getSharedState();
      state.matchedSite = matchedSite;
      state.matchedKey = matchedKey;

      // 1. Set up DOM bridge mutation observer for MAIN world interceptions
      const bridge = document.getElementById(BRIDGE_ID);
      if (bridge) {
        Detector.readBridge();
        const observer = new MutationObserver(() => Detector.readBridge());
        observer.observe(bridge, { childList: true, characterData: true, subtree: true });
      }

      // 2. Poll for canvas reader caching (e.g. EbookRenta, MangaPlaza Canvas viewer)
      if (matchedSite.imageSelector.includes('canvas')) {
        setInterval(() => {
          try {
            Downloader.captureVisibleCanvases();
          } catch (e) {}
        }, 1000);
      }

      // 3. Inject Floating Action Button and Sliding Panel
      await UI.createPanelUI(matchedSite, matchedKey);

    } catch (err) {
      console.error('Manga Downloader: Content initialization failed:', err);
    }
  }

  // Trigger Download Flow
  UI.triggerDownloadFlow = async function (actionBtn, title, chapter) {
    const selectedFormat = UI.getSavedFormat();
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

    const panelEl = document.querySelector('.manga-dl-panel');
    if (!panelEl) return;

    actionBtn.style.display = 'none';
    const progressContainer = panelEl.querySelector('#manga-dl-progress-container');
    const progressFill = panelEl.querySelector('#manga-dl-progress-fill');
    const statusText = panelEl.querySelector('#manga-dl-status-text');

    progressContainer.style.display = 'block';

    const processedImages = [];
    let successGroups = 0;
    let totalGroups = 0;

    {
      // Standard image downloads handler
      const images = Downloader.getImages();
      const needMerging = images.length > 30;
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
            if (url && url.startsWith('data:')) {
              return { success: true, dataUrl: url };
            }
            
            // Try DOM extraction first
            try {
              const selector = matchedSite ? matchedSite.imageSelector : '.reading-content img, .wp-manga-chapter-img img';
              const imgElement = Array.from(document.querySelectorAll(selector))
                .find(el => el.src === url || el.getAttribute('data-src') === url || el.getAttribute('data-lazy-src') === url || el.getAttribute('data-original') === url);
              
              if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.naturalWidth;
                canvas.height = imgElement.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);
                const dataUrl = canvas.toDataURL(mimeFormat === 'image/webp' ? 'image/webp' : (mimeFormat === 'image/png' ? 'image/png' : 'image/jpeg'), 0.9);
                if (dataUrl && dataUrl.startsWith('data:')) {
                  console.log('Manga Downloader: Successfully extracted image from DOM cache:', url.substring(0, 80));
                  return { success: true, dataUrl };
                }
              }
            } catch (domErr) {
              console.warn('Manga Downloader: DOM extraction failed, falling back to fetch:', domErr);
            }

            if (url.startsWith('blob:')) {
              try {
                const dataUrl = await Downloader.fetchBlobAsDataUrl(url);
                return { success: true, dataUrl };
              } catch (e) {
                console.error('Failed to fetch blob URL:', url, e);
                return { success: false };
              }
            } else {
              try {
                const dataUrl = await Downloader.fetchBlobAsDataUrl(url);
                return { success: true, dataUrl };
              } catch (e) {
                console.warn('Direct fetch in content script failed, falling back to background:', url, e);
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
              finalDataUrl = await Downloader.mergeImageGroup(successfulDataUrls, mimeFormat);
            } else {
              const originalDataUrl = successfulDataUrls[0];
              const originalMime = getMimeType(originalDataUrl);

              if (originalMime === mimeFormat) {
                finalDataUrl = originalDataUrl;
              } else {
                finalDataUrl = await Downloader.mergeImageGroup(successfulDataUrls, mimeFormat);
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
      statusText.innerHTML = `Lỗi! Không tải được ảnh nào.<br>
        <button class="manga-dl-copy-report-btn" id="manga-dl-download-error-report-btn" style="margin: 8px auto 0 auto;">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Sao chép báo cáo lỗi</span>
        </button>
      `;
      
      const dlErrorBtn = panelEl.querySelector('#manga-dl-download-error-report-btn');
      if (dlErrorBtn) {
        dlErrorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const report = Detector.generateErrorReport('download_failed_zero_images');
          navigator.clipboard.writeText(report).then(() => {
            const btnText = dlErrorBtn.querySelector('span');
            if (btnText) {
              const originalText = btnText.textContent;
              btnText.textContent = 'Đã sao chép! ✔';
              dlErrorBtn.style.background = 'rgba(16, 185, 129, 0.25)';
              dlErrorBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
              dlErrorBtn.style.color = '#34d399';
              setTimeout(() => {
                btnText.textContent = originalText;
                dlErrorBtn.style.background = '';
                dlErrorBtn.style.borderColor = '';
                dlErrorBtn.style.color = '';
              }, 2000);
            }
          });
        });
      }
      
      actionBtn.style.display = 'block';
      return;
    }

    statusText.textContent = `Đang tạo file ZIP...`;
    progressFill.style.width = '90%';

    const zip = new JSZip();
    processedImages.forEach(img => {
      const base64Data = img.dataUrl.split(',')[1];
      zip.file(img.filename, base64Data, { base64: true });
    });

    zip.generateAsync({ type: 'blob', compression: 'STORE' }).then(async (zipBlob) => {
      progressFill.style.width = '95%';
      statusText.textContent = `Đang tải xuống...`;

      const blobUrl = URL.createObjectURL(zipBlob);
      const safeTitle = Security.safeFilename(title, 'Manga');
      const safeChapter = Security.safeFilename(chapter, 'Chapter');
      const filename = `${safeTitle} - ${safeChapter}.zip`;

      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_BLOB_URL',
        data: {
          url: blobUrl,
          filename: filename
        }
      }, (response) => {
        URL.revokeObjectURL(blobUrl);

        if (response && response.success) {
          progressFill.style.width = '100%';
          statusText.style.color = '#10b981';
          statusText.textContent = `Thành công! Đã lưu file ZIP (${successGroups}/${totalGroups} trang).`;
          
          setTimeout(() => {
            panelEl.classList.remove('active');
          }, 3500);
        } else {
          statusText.style.color = '#ef4444';
          const errorMsg = response ? response.error : 'Không rõ nguyên nhân';
          statusText.innerHTML = `Lỗi đóng gói: ${escapeHtml(errorMsg)}<br>
            <button class="manga-dl-copy-report-btn" id="manga-dl-zip-error-report-btn" style="margin: 8px auto 0 auto;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Sao chép báo cáo lỗi</span>
            </button>
          `;
          
          const zipErrorBtn = panelEl.querySelector('#manga-dl-zip-error-report-btn');
          if (zipErrorBtn) {
            zipErrorBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const report = Detector.generateErrorReport('zip_failed: ' + errorMsg);
              navigator.clipboard.writeText(report).then(() => {
                const btnText = zipErrorBtn.querySelector('span');
                if (btnText) {
                  const originalText = btnText.textContent;
                  btnText.textContent = 'Đã sao chép! ✔';
                  zipErrorBtn.style.background = 'rgba(16, 185, 129, 0.25)';
                  zipErrorBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                  zipErrorBtn.style.color = '#34d399';
                  setTimeout(() => {
                    btnText.textContent = originalText;
                    zipErrorBtn.style.background = '';
                    zipErrorBtn.style.borderColor = '';
                    zipErrorBtn.style.color = '';
                  }, 2000);
                }
              });
            });
          }
          actionBtn.style.display = 'block';
        }
      });
    }).catch(err => {
      console.error('Error generating zip:', err);
      statusText.style.color = '#ef4444';
      statusText.textContent = `Lỗi đóng gói: ${err.message}`;
      actionBtn.style.display = 'block';
    });
  };

  // Run on page load
  init();

})();
