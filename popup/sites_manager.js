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

Dưới đây là cấu trúc HTML DOM đã lược bỏ (sanitized), lọc sạch thuộc tính rác và thu gọn của trang truyện này để bạn phân tích chính xác các CSS selector:
\\\`\\\`\\\`html
${domSnapshotHtml}
\\\`\\\`\\\`
`;

      if (this.homepageSearchDom) {
        fullPromptText += `
Dưới đây là cấu trúc HTML của phần Tìm kiếm (Search Form / Input) được trích xuất từ trang chủ của website này để bạn phân tích chính xác cấu trúc tìm kiếm:
\\\`\\\`\\\`html
${this.homepageSearchDom}
\\\`\\\`\\\`
`;
      }

      fullPromptText += `
Hãy đóng vai trò là một chuyên gia lập trình cào dữ liệu DOM và phân tích API Web. Phân tích cấu trúc HTML ở trên và tạo ra cấu hình JSON hoạt động tốt cho cả tính năng Tải truyện (thực thi trên trang đọc chương) và Tìm kiếm truyện (nếu trang web có hỗ trợ tìm kiếm).

MẸO PHÂN TÍCH QUAN TRỌNG (SỬ DỤNG DATA-AI-ROLE):
- Trong cấu trúc HTML DOM ở trên, một số thẻ quan trọng đã được tự động gắn thuộc tính \\\`data-ai-role\\\` để chỉ ra vai trò của chúng. Hãy ưu tiên sử dụng cấu trúc của các thẻ này để viết CSS selector chính xác:
  * Khi phân tích trang đọc chương truyện:
    + Thẻ chứa tên truyện: có thuộc tính \\\`data-ai-role="manga-title-candidate"\\\`
    + Thẻ chứa tên chương: có thuộc tính \\\`data-ai-role="manga-chapter-candidate"\\\`
    + Thẻ chứa các ảnh chương: có thuộc tính \\\`data-ai-role="manga-image-candidate"\\\`. Gợi ý thuộc tính lấy link ảnh nằm ở \\\`data-ai-attr-candidate\\\` (ví dụ: src hoặc data-src)
    + Thẻ container chứa ảnh chương: có thuộc tính \\\`data-ai-role="manga-image-container-candidate"\\\`
  * Khi phân tích trang tìm kiếm truyện (nếu HTML DOM là từ trang tìm kiếm/danh mục hoặc cấu trúc tìm kiếm trang chủ):
    + Ô nhập từ khóa (input): có thuộc tính \\\`data-ai-role="search-input-candidate"\\\`
    + Form tìm kiếm: có thuộc tính \\\`data-ai-role="search-form-candidate"\\\`
    + Container danh sách kết quả: có thuộc tính \\\`data-ai-role="search-results-container-candidate"\\\`
    + Khung/Thẻ của từng truyện trong kết quả: có thuộc tính \\\`data-ai-role="search-result-item-candidate"\\\`
    + Thẻ chứa tên truyện trong kết quả: có thuộc tính \\\`data-ai-role="search-result-title-candidate"\\\`
    + Thẻ chứa ảnh bìa trong kết quả: có thuộc tính \\\`data-ai-role="search-result-cover-candidate"\\\`
- Hãy sử dụng class hoặc ID hoặc cấu trúc cha-con từ các thẻ có gắn thuộc tính này để viết CSS Selector ngắn gọn và chính xác. Tránh dùng các class động/ngẫu nhiên.

QUY TẮC PHÂN TÍCH VÀ ĐIỀN THÔNG TIN CHI TIẾT:
1. **domainPattern**: Viết chuỗi Regex ngắn gọn để khớp với tên miền của trang web đó (ví dụ: \\\`nettruyen(?:new|co|top|me|tv)?\\\\.com|nhattruyen\\\`). Hãy đảm bảo chuỗi Regex của bạn an toàn, không có lỗi cú pháp JSON.
2. **chapterUrlPattern**: Chuỗi regex dùng để nhận diện trang đọc truyện (ví dụ: \\\`chap|chuong|chapter\\\`).
3. **imageSelector**: Bộ chọn chọn tất cả các ảnh của chương truyện (ví dụ: \\\`.page-chapter img\\\`). Hãy viết bộ chọn sao cho không bị lẫn các banner quảng cáo hay ảnh avatar người dùng ở dưới. Nếu tên class có chứa hash ngẫu nhiên (CSS Modules), hãy dùng bộ chọn thuộc tính như \\\`[class*="wt_viewer"] img\\\`.
4. **imageUrlAttribute**: Thuộc tính của thẻ ảnh chứa link ảnh thực tế. Vì nhiều trang sử dụng lazyload, thuộc tính này có thể là \\\`data-original\\\`, \\\`data-src\\\`, \\\`data-lazy-src\\\`. Hãy viết dưới dạng chuỗi các thuộc tính phân tách bằng dấu gạch đứng theo thứ tự ưu tiên (ví dụ: \\\`data-original|data-src|src\\\`).
5. **titleSelector**: Bộ chọn lấy tên truyện gốc (ví dụ: \\\`h1.txt-primary\\\` hoặc \\\`.breadcrumb li:nth-last-child(2) a\\\`).
6. **chapterSelector**: Bộ chọn lấy tên/số chương hiện tại (ví dụ: \\\`.breadcrumb li:last-child a\\\` hoặc \\\`h1.txt-primary\\\`).
7. **referer**: Link referer cần thiết để bypass hotlink protection (thường là \\\`https://[domain-goc]/\\\`).
8. **searchSupported**: Giá trị boolean biểu thị trang web có hỗ trợ tìm kiếm hay không.
9. **searchUrl**: URL tìm kiếm mẫu, trong đó từ khóa tìm kiếm được thay thế bằng chuỗi \\\`{query}\\\` (ví dụ: \\\`https://www.nettruyennew.com/tim-truyen?keyword={query}\\\` hoặc \\\`https://mangadex.org/search?q={query}\\\`).
10. **searchResultSelector**: Bộ chọn chọn từng khung chứa một truyện trong trang kết quả tìm kiếm.
11. **searchTitleSelector** / **searchCoverSelector** / **searchAuthorSelector**: Bộ chọn tương đối (relative selector) trỏ từ thẻ truyện của kết quả (\\\`searchResultSelector\\\`) tới tên truyện, ảnh bìa và tác giả tương ứng.

PHÂN TÍCH NATIVE API/AJAX ENDPOINTS:
- Hãy nghiên cứu xem trang web có gọi API ngầm (XHR/Fetch) để tải ảnh hoặc tìm kiếm hay không. Nếu có, hãy mô tả chi tiết URL Endpoint, HTTP Method, cấu trúc Request/Response và cách parse dữ liệu ngay dưới khối JSON.

Yêu cầu định dạng kết quả trả về:
1. Chỉ trả về một khối mã JSON duy nhất khớp chính xác theo mẫu dưới đây.
2. Ngay bên dưới khối JSON, nếu có thông tin về API/AJAX ngầm, hãy đính kèm phần phân tích chi tiết của bạn. Nếu không, ghi "Không phát hiện API ngầm khả thi, sử dụng bóc tách DOM HTML".

\\\`\\\`\\\`json
{
  "name": "\${siteName}",
  "domainPattern": "\${domainPattern}",
  "chapterUrlPattern": "[chuỗi regex để khớp URL trang đọc chương, ví dụ: chap|chuong|chapter]",
  "imageSelector": "[CSS selector chọn các thẻ ảnh chương truyện]",
  "imageUrlAttribute": "[tên thuộc tính hoặc danh sách phân tách bằng | ví dụ: data-original|data-src|src]",
  "titleSelector": "[CSS selector chọn tên truyện]",
  "chapterSelector": "[CSS selector chọn tên chương truyện]",
  "referer": "\${sampleUrl && sampleUrl.startsWith('http') ? new URL(sampleUrl).origin + '/' : ''}",
  "isNsfw": false,
  "searchSupported": true,
  "searchUrl": "[Link URL tìm kiếm của trang với từ khóa là {query}, ví dụ: https://example.com/search?q={query}]",
  "searchResultSelector": "[CSS selector chọn khung của từng truyện trong kết quả]",
  "searchTitleSelector": "[CSS selector tương đối chọn tên truyện]",
  "searchCoverSelector": "[CSS selector tương đối chọn ảnh bìa]",
  "searchAuthorSelector": "[CSS selector tương đối chọn tác giả hoặc để trống nếu không có]"
}
\\\`\\\`\\\``;

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
