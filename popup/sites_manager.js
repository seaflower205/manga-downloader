(function (root) {
  'use strict';

  const Security = root.MangaSecurity || window.MangaSecurity;

  class SitesManager {
    constructor() {
      this.sitesFileInput = null;
      this.sitesTextInput = null;
      this.aiSiteName = null;
      this.aiSampleUrl = null;
      this.aiPromptPreview = null;
      this.btnCopyPrompt = null;
      this.btnCopyPromptLarge = null;
      this.domSnapshot = '';
      this.homepageSearchDom = '';
    }

    setDomSnapshot(html) {
      this.domSnapshot = html || '';
      this.generateAiPrompt();
    }

    clearHomepageSearchDom() {
      this.homepageSearchDom = '';
      this.generateAiPrompt();
    }

    extractAndSetHomepageSearchDom(html) {
      this.homepageSearchDom = this.extractSearchDomFromHtml(html) || '';
      this.generateAiPrompt();
    }

    extractSearchDomFromHtml(htmlString) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        const searchElements = new Set();
        
        doc.querySelectorAll('form').forEach(form => {
          searchElements.add(form);
        });
        
        doc.querySelectorAll('input').forEach(input => {
          const type = (input.getAttribute('type') || 'text').toLowerCase();
          if (['text', 'search'].includes(type)) {
            const id = (input.id || '').toLowerCase();
            const name = (input.getAttribute('name') || '').toLowerCase();
            const className = (input.className || '').toLowerCase();
            const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
            if (/search|find|query|keyword|tim-kiem|timkiem|\bs\b/i.test(id + name + className + placeholder)) {
              searchElements.add(input);
              const parentForm = input.closest('form');
              if (parentForm) searchElements.add(parentForm);
              
              let parent = input.parentElement;
              let depth = 0;
              while (parent && depth < 3 && parent.tagName.toLowerCase() !== 'body') {
                searchElements.add(parent);
                parent = parent.parentElement;
                depth++;
              }
            }
          }
        });

        if (searchElements.size === 0) {
          return '';
        }

        const bodyClone = doc.body.cloneNode(true);
        
        const isSearchRelated = (node) => {
          if (!node.tagName) return false;
          const tag = node.tagName.toLowerCase();
          if (tag === 'form') return true;
          if (tag === 'input') {
            const type = (node.getAttribute('type') || 'text').toLowerCase();
            if (['text', 'search'].includes(type)) {
              const id = (node.id || '').toLowerCase();
              const name = (node.getAttribute('name') || '').toLowerCase();
              const className = (node.className || '').toLowerCase();
              const placeholder = (node.getAttribute('placeholder') || '').toLowerCase();
              if (/search|find|query|keyword|tim-kiem|timkiem|\bs\b/i.test(id + name + className + placeholder)) {
                return true;
              }
            }
          }
          if (node.querySelector('form, input[type="search"], input[name*="search"], input[name*="query"], input[name="s"], input[name="q"], input[placeholder*="search"], input[placeholder*="tìm"]')) {
            return true;
          }
          return false;
        };

        const pruneNonSearch = (node) => {
          const children = Array.from(node.children);
          children.forEach(child => {
            if (!isSearchRelated(child)) {
              child.remove();
            } else {
              pruneNonSearch(child);
            }
          });
        };
        
        pruneNonSearch(bodyClone);
        
        bodyClone.querySelectorAll('*').forEach(el => {
          el.querySelectorAll('svg, path, symbol, g, use, rect, circle, polyline, polygon, line, mask, clippath, defs, linearGradient, radialGradient, stop').forEach(svg => svg.remove());
          
          Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'style') {
              el.removeAttribute(attr.name);
            }
          });
        });

        bodyClone.querySelectorAll('input').forEach(input => {
          const type = (input.getAttribute('type') || 'text').toLowerCase();
          if (['text', 'search'].includes(type)) {
            input.setAttribute('data-ai-role', 'search-input-candidate');
            const form = input.closest('form');
            if (form) {
              form.setAttribute('data-ai-role', 'search-form-candidate');
            }
          }
        });
        
        return bodyClone.innerHTML.trim();
      } catch (e) {
        console.warn('Failed to extract search DOM from homepage:', e);
        return '';
      }
    }

    init(popupInstance) {
      this.popup = popupInstance;

      // Configuration Import/Export Elements
      const btnExport = document.getElementById('btn-export-sites');
      const btnImport = document.getElementById('btn-import-sites');
      this.sitesFileInput = document.getElementById('sites-file-input');

      if (btnExport) {
        btnExport.addEventListener('click', () => this.exportAllSites());
      }
      if (btnImport && this.sitesFileInput) {
        btnImport.addEventListener('click', () => this.sitesFileInput.click());
        this.sitesFileInput.addEventListener('change', (e) => this.importSites(e));
      }

      // Text Configuration Import Elements
      const btnImportText = document.getElementById('btn-import-sites-text');
      this.sitesTextInput = document.getElementById('sites-text-input');
      if (btnImportText && this.sitesTextInput) {
        btnImportText.addEventListener('click', () => this.importSitesFromText());
      }

      // AI Prompt Generator Elements
      this.aiSiteName = document.getElementById('ai-site-name');
      this.aiSampleUrl = document.getElementById('ai-sample-url');
      this.aiPromptPreview = document.getElementById('ai-prompt-preview');
      this.btnCopyPrompt = document.getElementById('btn-copy-prompt');
      this.btnCopyPromptLarge = document.getElementById('btn-copy-prompt-large');

      if (this.aiSiteName && this.aiSampleUrl && this.aiPromptPreview) {
        const updatePrompt = () => this.generateAiPrompt();
        this.aiSiteName.addEventListener('input', updatePrompt);
        this.aiSampleUrl.addEventListener('input', updatePrompt);
        updatePrompt(); // Initialize empty template
      }

      if (this.btnCopyPrompt) {
        this.btnCopyPrompt.addEventListener('click', () => this.copyPromptToClipboard());
      }
      if (this.btnCopyPromptLarge) {
        this.btnCopyPromptLarge.addEventListener('click', () => this.copyPromptToClipboard());
      }
    }

    async exportAllSites() {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage) {
          this.popup.showNotification('Môi trường không hỗ trợ extension!', 'error');
          return;
        }
        const data = await chrome.storage.local.get('sites');
        const sites = data.sites || {};
        
        const jsonString = JSON.stringify(sites, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `manga-downloader-sites-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.popup.showNotification('Đã xuất cấu hình website thành công!', 'success');
      } catch (error) {
        console.error('Export failed:', error);
        this.popup.showNotification('Lỗi khi xuất cấu hình website.', 'error');
        Security.logDiagnostic({ feature: 'export_sites', error });
      }
    }

    async importSites(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const parsed = JSON.parse(content);
          
          if (!parsed || typeof parsed !== 'object') {
            this.popup.showNotification('Định dạng tệp không hợp lệ! Phải là JSON Object.', 'error');
            return;
          }

          // Preprocess: Convert {keyword} to {query} in searchUrl, wrap single config
          let configMap = {};
          if (parsed.name && parsed.domainPattern) {
            const key = Security.slugKey(parsed.name);
            configMap[key] = parsed;
          } else {
            configMap = parsed;
          }

          Object.keys(configMap).forEach(key => {
            const site = configMap[key];
            if (site && typeof site === 'object') {
              if (typeof site.searchUrl === 'string') {
                site.searchUrl = site.searchUrl.replace(/\{keyword\}/gi, '{query}');
              }
              if (site.searchUrl && site.searchResultSelector) {
                site.searchSupported = true;
              }
            }
          });

          // Validate and sanitize the site configurations
          const { sites: sanitizedSites, skipped } = Security.sanitizeSiteMap(configMap);
          
          if (Object.keys(sanitizedSites).length === 0) {
            this.popup.showNotification('Không tìm thấy cấu hình hợp lệ nào trong file nhập.', 'error');
            return;
          }

          // Fetch current sites and merge them
          const data = await chrome.storage.local.get('sites');
          const currentSites = data.sites || {};
          const mergedSites = { ...currentSites, ...sanitizedSites };

          await chrome.storage.local.set({ sites: mergedSites });
          
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
          
          let message = `Đã nhập thành công ${Object.keys(sanitizedSites).length} cấu hình website.`;
          if (skipped.length > 0) {
            message += ` Bỏ qua ${skipped.length} mục không hợp lệ.`;
          }

          this.popup.showNotification(message, skipped.length > 0 ? 'warning' : 'success');
          
          // Re-load the site list in popup
          if (typeof this.popup.loadSites === 'function') {
            await this.popup.loadSites();
          }
        } catch (err) {
          console.error('Import failed:', err);
          this.popup.showNotification('Lỗi khi đọc hoặc phân tích tệp JSON.', 'error');
        } finally {
          this.sitesFileInput.value = ''; // Reset uploader element
        }
      };
      reader.readAsText(file);
    }

    async importSitesFromText() {
      if (!this.sitesTextInput) return;
      const text = this.sitesTextInput.value.trim();
      if (!text) {
        this.popup.showNotification('Vui lòng dán nội dung cấu hình JSON vào ô văn bản.', 'error');
        return;
      }

      try {
        // Extract JSON substring (find first '{' and last '}')
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
          this.popup.showNotification('Không tìm thấy dữ liệu JSON hợp lệ (thiếu ký tự { hoặc }).', 'error');
          return;
        }

        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        let parsed = JSON.parse(jsonStr);

        if (!parsed || typeof parsed !== 'object') {
          this.popup.showNotification('Dữ liệu phân tích được không phải là JSON Object.', 'error');
          return;
        }

        // Check if single site config, wrap it in a map if so
        let configMap = {};
        if (parsed.name && parsed.domainPattern) {
          const key = Security.slugKey(parsed.name);
          configMap[key] = parsed;
        } else {
          configMap = parsed;
        }

        // Preprocess: Convert {keyword} to {query} in searchUrl
        Object.keys(configMap).forEach(key => {
          const site = configMap[key];
          if (site && typeof site === 'object') {
            if (typeof site.searchUrl === 'string') {
              site.searchUrl = site.searchUrl.replace(/\{keyword\}/gi, '{query}');
            }
            if (site.searchUrl && site.searchResultSelector) {
              site.searchSupported = true;
            }
          }
        });

        // Validate and sanitize the site configurations
        const { sites: sanitizedSites, skipped } = Security.sanitizeSiteMap(configMap);

        if (Object.keys(sanitizedSites).length === 0) {
          this.popup.showNotification('Không tìm thấy cấu hình hợp lệ nào trong văn bản đã nhập.', 'error');
          return;
        }

        // Fetch current sites and merge them
        const data = await chrome.storage.local.get('sites');
        const currentSites = data.sites || {};
        const mergedSites = { ...currentSites, ...sanitizedSites };

        await chrome.storage.local.set({ sites: mergedSites });

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

        let message = `Đã nhập thành công ${Object.keys(sanitizedSites).length} cấu hình website từ văn bản.`;
        if (skipped.length > 0) {
          message += ` Bỏ qua ${skipped.length} mục không hợp lệ.`;
        }

        this.popup.showNotification(message, skipped.length > 0 ? 'warning' : 'success');
        this.sitesTextInput.value = ''; // Clear input on success

        // Re-load the site list in popup
        if (typeof this.popup.loadSites === 'function') {
          await this.popup.loadSites();
        }
      } catch (err) {
        console.error('Import from text failed:', err);
        this.popup.showNotification('Lỗi khi đọc hoặc phân tích cú pháp JSON.', 'error');
      }
    }

    generateAiPrompt() {
      const siteName = Security.toSafeString(this.aiSiteName.value).trim() || '[Tên Website]';
      const sampleUrl = Security.toSafeString(this.aiSampleUrl.value).trim() || '[URL Chương Truyện]';

      let promptTemplate = `Tôi cần cấu hình JSON cho trang web truyện:
- Tên website: ${siteName}
- URL chương mẫu: ${sampleUrl}

(Cấu trúc HTML DOM của trang web sẽ được tự động đính kèm vào nội dung sao chép khi nhấn Sao chép)`;

      if (this.homepageSearchDom) {
        promptTemplate += `\n- Ghi chú: Đã đính kèm cấu trúc ô tìm kiếm từ trang chủ để phân tích chính xác cấu hình tìm kiếm.`;
      }

      promptTemplate += `\n\nHãy đóng vai trò là một chuyên gia lập trình cào dữ liệu DOM. Phân tích cấu trúc HTML và tạo ra cấu hình JSON hoạt động tốt cho cả tính năng Tải truyện (thực thi trên trang đọc chương) và Tìm kiếm truyện (sử dụng cấu trúc tìm kiếm được đính kèm ở trang chủ hoặc suy luận của bạn).`;

      this.aiPromptPreview.value = promptTemplate;
    }

    async copyPromptToClipboard() {
      const siteName = Security.toSafeString(this.aiSiteName.value).trim() || '[Tên Website]';
      const sampleUrl = Security.toSafeString(this.aiSampleUrl.value).trim() || '[URL Chương Truyện]';
      
      let domainPattern = '[pattern_domain]';
      if (sampleUrl && sampleUrl.startsWith('http')) {
        try {
          const parsed = new URL(sampleUrl);
          domainPattern = parsed.hostname.replace('www.', '').replace(/\./g, '\\.');
        } catch (_) {}
      }

      const domSnapshotHtml = this.domSnapshot ? this.domSnapshot.slice(0, 200000) : '[Chưa lấy được HTML của trang. Hãy chắc chắn bạn đang mở trang đọc truyện và mở lại addon]';

      let fullPromptText = `Tôi cần cấu hình JSON cho trang web truyện:
- Tên website: ${siteName}
- URL chương mẫu: ${sampleUrl}

Dưới đây là cấu trúc HTML DOM đã lược bỏ (sanitized) và thu gọn của trang truyện này để bạn phân tích chính xác các CSS selector:
\`\`\`html
${domSnapshotHtml}
\`\`\`
`;

      if (this.homepageSearchDom) {
        fullPromptText += `
Dưới đây là cấu trúc HTML của phần Tìm kiếm (Search Form / Input) được trích xuất từ trang chủ của website này để bạn phân tích chính xác cấu trúc tìm kiếm:
\`\`\`html
${this.homepageSearchDom}
\`\`\`
`;
      }

      fullPromptText += `
Hãy đóng vai trò là một chuyên gia lập trình cào dữ liệu DOM và phân tích API Web. Phân tích cấu trúc HTML ở trên và tạo ra cấu hình JSON hoạt động tốt cho cả tính năng Tải truyện (thực thi trên trang đọc chương) và Tìm kiếm truyện (nếu trang web có hỗ trợ tìm kiếm).

MẸO PHÂN TÍCH QUAN TRỌNG (SỬ DỤNG DATA-AI-ROLE):
- Trong cấu trúc HTML DOM ở trên, một số thẻ quan trọng đã được tự động gắn thuộc tính \`data-ai-role\` để chỉ ra vai trò của chúng. Hãy ưu tiên sử dụng cấu trúc của các thẻ này để viết CSS selector chính xác:
  * Khi phân tích trang đọc chương truyện:
    + Thẻ chứa tên truyện: có thuộc tính \`data-ai-role="manga-title-candidate"\`
    + Thẻ chứa tên chương: có thuộc tính \`data-ai-role="manga-chapter-candidate"\`
    + Thẻ chứa các ảnh chương: có thuộc tính \`data-ai-role="manga-image-candidate"\`. Gợi ý thuộc tính lấy link ảnh nằm ở \`data-ai-attr-candidate\` (ví dụ: src hoặc data-src)
    + Thẻ container chứa ảnh chương: có thuộc tính \`data-ai-role="manga-image-container-candidate"\`
  * Khi phân tích trang tìm kiếm truyện (nếu HTML DOM là từ trang tìm kiếm/danh mục hoặc cấu trúc tìm kiếm trang chủ):
    + Ô nhập từ khóa (input): có thuộc tính \`data-ai-role="search-input-candidate"\`
    + Form tìm kiếm: có thuộc tính \`data-ai-role="search-form-candidate"\`
    + Container danh sách kết quả: có thuộc tính \`data-ai-role="search-results-container-candidate"\`
    + Khung/Thẻ của từng truyện trong kết quả: có thuộc tính \`data-ai-role="search-result-item-candidate"\`
    + Thẻ chứa tên truyện trong kết quả: có thuộc tính \`data-ai-role="search-result-title-candidate"\`
    + Thẻ chứa ảnh bìa trong kết quả: có thuộc tính \`data-ai-role="search-result-cover-candidate"\`
- Hãy sử dụng class hoặc ID hoặc cấu trúc cha-con từ các thẻ có gắn thuộc tính này để viết CSS Selector ngắn gọn và chính xác. Tránh dùng các class động/ngẫu nhiên.

LƯU Ý QUAN TRỌNG VỀ TÌM KIẾM TRUYỆN & PHÂN TÍCH API/AJAX:
- Nếu có cấu trúc tìm kiếm trang chủ ở trên, bạn hãy phân tích nó để tìm ra \`searchUrl\` (dựa trên thuộc tính action của form và name của input) cùng các cấu trúc class.
- Nếu không có, hoặc nếu cấu trúc HTML ở trên không chứa ô tìm kiếm, bạn hãy sử dụng kiến thức sẵn có của mình về trang web này HOẶC suy luận từ cấu trúc của các hệ thống CMS phổ biến (ví dụ: WordPress Madara, MangaStream, Blogger, Custom...) để tự điền các thông tin tìm kiếm dưới đây thay vì bỏ trống hoặc điền false.
- Ví dụ về cấu trúc URL tìm kiếm phổ biến:
  * WordPress Madara: https://${domainPattern.replace(/\\\./g, '.')}/?s={query}&post_type=wp-manga
  * WordPress MangaStream: https://${domainPattern.replace(/\\\./g, '.')}/?s={query}
  * Các trang Custom khác: https://${domainPattern.replace(/\\\./g, '.')}/search?q={query} hoặc https://${domainPattern.replace(/\\\./g, '.')}/tim-kiem?keyword={query}

ĐẶC BIỆT CHÚ Ý TÌM BỘ CHỌN TÁC GIẢ (AUTHOR SELECTOR):
- Hãy luôn cố gắng tìm bộ chọn tác giả từ trang chi tiết truyện (Detail Page DOM) hoặc trang danh sách kết quả (nếu có hiển thị tác giả, ví dụ: các thẻ chứa class \`author\` hoặc liên kết có chứa \`/author/\`).
- Nếu trong kết quả tìm kiếm danh sách không hiển thị tên tác giả nhưng trang chi tiết truyện có hiển thị (ví dụ: các thẻ có class là \`.author a\` hoặc \`.authors a\`), bạn hãy khai báo bộ chọn đó ở trường \`searchAuthorSelector\` (ví dụ: \`.author\` hoặc \`.author a\`). Hệ thống của chúng tôi được thiết kế để tự động nhận dạng bộ chọn này khi phân tích trang chi tiết truyện hoặc kết quả tìm kiếm chuyển hướng để trích xuất đầy đủ tác giả.

PHÂN TÍCH NATIVE API/AJAX ENDPOINTS:
- Hãy nghiên cứu hoặc suy luận xem trang web này có gọi các API ngầm (XHR/Fetch) trực tiếp để lấy danh sách ảnh chương, thông tin chương hoặc tìm kiếm truyện hay không (ví dụ: gọi API trả về dữ liệu dạng JSON thay vì HTML dựng sẵn).
- Nếu website có sử dụng API/AJAX ngầm:
  * Hãy cung cấp thông tin phân tích chi tiết về API đó ngay bên dưới khối cấu hình JSON.
  * Chi tiết cần bao gồm: URL Endpoint API, HTTP Method (GET/POST/etc.), định dạng của Request Payload/Query parameters (như tên tham số tìm kiếm, token bảo mật, page, v.v.), cấu trúc trường dữ liệu trong JSON trả về, và cách bóc tách giá trị từ JSON đó (ví dụ: lấy link ảnh ở thuộc tính nào, danh sách tìm kiếm ở mảng nào).
  * Việc này rất quan trọng để chúng tôi nâng cấp mã nguồn addon, thiết lập cơ chế Direct API Query/Fetch tương tự Mangaball/Naver Webtoon nhằm tăng hiệu năng và độ ổn định.

Yêu cầu định dạng kết quả trả về:
1. Đầu tiên, trả về cấu hình JSON chính xác theo mẫu dưới đây.
2. Ngay bên dưới khối JSON, nếu có thông tin về API/AJAX ngầm của trang web, hãy đính kèm phần phân tích chi tiết của bạn. Nếu không phát hiện API khả thi, ghi rõ "Không phát hiện API ngầm khả thi, sử dụng bóc tách DOM HTML".

\`\`\`json
{
  "name": "${siteName}",
  "domainPattern": "${domainPattern}",
  "imageSelector": "[CSS selector chọn các thẻ ảnh chương truyện, ví dụ: .page-chapter img hoặc .chapter-content img. LƯU Ý: Nếu các tên class có chứa mã hash ngẫu nhiên dạng CSS Modules như .wt_viewer--abcde, hãy dùng bộ chọn thuộc tính dạng [class*=\\"wt_viewer\\"] img]",
  "imageUrlAttribute": "src|data-original|data-src",
  "titleSelector": "[CSS selector chọn tên truyện, ví dụ: .manga-title hoặc h1. Dùng bộ chọn wildcard [class*=\\"title\\"] nếu tên class có hash]",
  "chapterSelector": "[CSS selector chọn tên chương truyện, ví dụ: .chapter-title hoặc h2. Dùng bộ chọn wildcard [class*=\\"chapter\\"] nếu tên class có hash]",
  "referer": "${sampleUrl && sampleUrl.startsWith('http') ? new URL(sampleUrl).origin + '/' : ''}",
  "isNsfw": false,
  "searchSupported": true,
  "searchUrl": "[Link URL tìm kiếm của website với tham số từ khóa được thay bằng {query}, ví dụ: https://${domainPattern.replace(/\\\./g, '.')}/?s={query} hoặc https://${domainPattern.replace(/\\\./g, '.')}/search?q={query}. Hãy tự suy luận dựa trên tên miền và CMS của trang]",
  "searchResultSelector": "[CSS selector chọn từng thẻ/khung chứa thông tin của một truyện trong danh sách kết quả tìm kiếm (ví dụ: .c-tabs-item__content, .search-wrap .row .item-col, .list-story .item-list hoặc tương tự)]",
  "searchTitleSelector": "[CSS selector (tương đối từ searchResultSelector) để chọn thẻ chứa tên truyện, ví dụ: .post-title a hoặc h3 a]",
  "searchCoverSelector": "[CSS selector (tương đối từ searchResultSelector) để chọn thẻ ảnh bìa, ví dụ: img]",
  "searchAuthorSelector": "[CSS selector (tương đối từ searchResultSelector) để chọn thẻ chứa tên tác giả nếu có, ví dụ: .author a hoặc để rỗng]"
}
\`\`\``;

      try {
        await navigator.clipboard.writeText(fullPromptText);
        
        // Temporarily change copy button text to show success
        let originalText = '';
        if (this.btnCopyPrompt) {
          originalText = this.btnCopyPrompt.textContent;
          this.btnCopyPrompt.textContent = 'Đã sao chép!';
          this.btnCopyPrompt.style.color = '#10B981';
        }

        let originalTextLarge = '';
        if (this.btnCopyPromptLarge) {
          const spanLarge = this.btnCopyPromptLarge.querySelector('span');
          if (spanLarge) {
            originalTextLarge = spanLarge.textContent;
            spanLarge.textContent = 'Đã sao chép!';
          }
        }
        
        setTimeout(() => {
          if (this.btnCopyPrompt) {
            this.btnCopyPrompt.textContent = originalText;
            this.btnCopyPrompt.style.color = '';
          }
          if (this.btnCopyPromptLarge) {
            const spanLarge = this.btnCopyPromptLarge.querySelector('span');
            if (spanLarge) {
              spanLarge.textContent = originalTextLarge;
            }
          }
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
        this.popup.showNotification('Không thể sao chép tự động. Vui lòng tự bôi đen và copy.', 'error');
      }
    }
  }

  root.SitesManager = new SitesManager();
})(typeof globalThis !== 'undefined' ? globalThis : this);
