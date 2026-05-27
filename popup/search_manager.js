(function (root) {
  'use strict';

  const Security = root.MangaSecurity || window.MangaSecurity;

  class SearchManager {
    constructor() {
      this.popup = null;
      this.currentSearchId = null;
      this.currentSearchHasResults = false;
      this.defaultSearchFinished = false;
      this.activeCustomSearchesCount = 0;

      this.currentNsfwSearchId = null;
      this.currentNsfwSearchHasResults = false;
      this.nsfwSearchFinished = false;
      this.activeNsfwCustomSearchesCount = 0;
    }

    init(popupInstance) {
      this.popup = popupInstance;

      // Register elements
      this.mangaSearchInput = document.getElementById('manga-search-input');
      this.btnMangaSearch = document.getElementById('btn-manga-search');
      this.mangaSearchLoading = document.getElementById('manga-search-loading');
      this.mangaSearchResults = document.getElementById('manga-search-results');

      this.nsfwSearchInput = document.getElementById('nsfw-search-input');
      this.btnNsfwSearch = document.getElementById('btn-nsfw-search');
      this.nsfwSearchLoading = document.getElementById('nsfw-search-loading');
      this.nsfwSearchResults = document.getElementById('nsfw-search-results');

      // Bind search event listeners
      if (this.btnMangaSearch && this.mangaSearchInput) {
        this.btnMangaSearch.addEventListener('click', () => this.performMangaSearch());
        this.mangaSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.performMangaSearch();
        });
      }

      if (this.btnNsfwSearch && this.nsfwSearchInput) {
        this.btnNsfwSearch.addEventListener('click', () => this.performNsfwSearch());
        this.nsfwSearchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.performNsfwSearch();
        });
      }

      // Bind select all / clear all source buttons
      const btnSelectAll = document.getElementById('btn-select-all-sources');
      const btnClearAll = document.getElementById('btn-clear-all-sources');
      if (btnSelectAll && btnClearAll) {
        btnSelectAll.addEventListener('click', () => this.setAllSearchSources(false, false));
        btnClearAll.addEventListener('click', () => this.setAllSearchSources(true, false));
      }

      const btnSelectAllNsfw = document.getElementById('btn-select-all-nsfw');
      const btnClearAllNsfw = document.getElementById('btn-clear-all-nsfw');
      if (btnSelectAllNsfw && btnClearAllNsfw) {
        btnSelectAllNsfw.addEventListener('click', () => this.setAllSearchSources(false, true));
        btnClearAllNsfw.addEventListener('click', () => this.setAllSearchSources(true, true));
      }

      // Bind filter radios
      const filterRadios = document.querySelectorAll('input[name="search-filter-type"]');
      filterRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          const authorWarning = document.getElementById('author-search-warning');
          if (authorWarning) {
            authorWarning.style.display = radio.value === 'author' ? 'inline' : 'none';
          }
          this.applySearchFilter('manga-search-results', radio.value, this.mangaSearchInput.value);
        });
      });

      const nsfwFilterRadios = document.querySelectorAll('input[name="nsfw-search-filter-type"]');
      nsfwFilterRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          const authorWarning = document.getElementById('nsfw-author-search-warning');
          if (authorWarning) {
            authorWarning.style.display = radio.value === 'author' ? 'inline' : 'none';
          }
          this.applySearchFilter('nsfw-search-results', radio.value, this.nsfwSearchInput.value);
        });
      });

      // Register Chrome runtime message listener for chunk streams
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message) return;

        if (message.type === 'SEARCH_RESULTS_CHUNK') {
          if (message.searchId === this.currentSearchId) {
            const results = Array.isArray(message.results) ? message.results : [];
            if (results.length > 0) {
              this.currentSearchHasResults = true;
              results.forEach(item => this.renderSearchResult(item, this.mangaSearchResults, false));
            }
          } else if (message.searchId === this.currentNsfwSearchId) {
            const results = Array.isArray(message.results) ? message.results : [];
            if (results.length > 0) {
              this.currentNsfwSearchHasResults = true;
              results.forEach(item => this.renderSearchResult(item, this.nsfwSearchResults, true));
            }
          }
        } else if (message.type === 'SEARCH_CLOUDFLARE_BLOCKED') {
          if (message.searchId === this.currentSearchId) {
            this.handleSearchCloudflareBlocked({
              siteKey: message.siteKey,
              sourceName: message.sourceName,
              url: message.url
            }, this.mangaSearchResults);
          } else if (message.searchId === this.currentNsfwSearchId) {
            this.handleSearchCloudflareBlocked({
              siteKey: message.siteKey,
              sourceName: message.sourceName,
              url: message.url
            }, this.nsfwSearchResults);
          }
        } else if (message.type === 'SEARCH_FINISHED') {
          if (message.searchId === this.currentSearchId) {
            this.defaultSearchFinished = true;
            this.checkSearchCompletion();
          } else if (message.searchId === this.currentNsfwSearchId) {
            this.nsfwSearchFinished = true;
            this.checkNsfwSearchCompletion();
          }
        }
      });
    }

    async setAllSearchSources(disable, isNsfw) {
      const keys = Object.keys(this.popup.allSites).filter(k => {
        const site = this.popup.allSites[k];
        if (isNsfw ? !site.isNsfw : site.isNsfw) return false;
        return Boolean(site.searchSupported) || Boolean(site.searchUrl && site.searchResultSelector);
      });

      if (disable) {
        keys.forEach(k => {
          if (!this.popup.disabledSearchSites.includes(k)) {
            this.popup.disabledSearchSites.push(k);
          }
        });
      } else {
        this.popup.disabledSearchSites = this.popup.disabledSearchSites.filter(k => !keys.includes(k));
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ disabledSearchSites: this.popup.disabledSearchSites });
      }

      if (isNsfw) {
        if (typeof this.popup.renderNsfwSearchBadges === 'function') this.popup.renderNsfwSearchBadges();
      } else {
        if (typeof this.popup.renderSearchBadges === 'function') this.popup.renderSearchBadges();
      }
      this.updateSearchResultsVisibility(isNsfw ? 'nsfw-search-results' : 'manga-search-results');
    }

    applySearchFilter(containerId, filterType, query) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const cards = container.querySelectorAll('.search-result-card');
      const cleanQuery = query.toLowerCase().trim();

      cards.forEach(card => {
        const sourceKey = card.getAttribute('data-source-key');
        if (this.popup.disabledSearchSites && this.popup.disabledSearchSites.includes(sourceKey)) {
          card.style.display = 'none';
          return;
        }

        const titleEl = card.querySelector('.search-result-title');
        const authorEl = card.querySelector('.search-result-author');
        const title = titleEl ? titleEl.textContent.toLowerCase() : '';
        const author = authorEl ? authorEl.textContent.toLowerCase() : '';

        let matches = true;
        if (cleanQuery) {
          if (filterType === 'title') {
            matches = title.includes(cleanQuery);
          } else if (filterType === 'author') {
            matches = author.includes(cleanQuery);
          } else {
            matches = title.includes(cleanQuery) || author.includes(cleanQuery);
          }
        }

        card.style.display = matches ? 'flex' : 'none';
      });

      // If all cards are hidden, show empty message
      const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
      if (visibleCards.length === 0 && cards.length > 0) {
        const hasNoResultBox = container.querySelector('.filter-empty-box');
        if (!hasNoResultBox) {
          const box = document.createElement('div');
          box.className = 'filter-empty-box';
          box.style.textAlign = 'center';
          box.style.color = 'var(--text-secondary)';
          box.style.padding = '30px 10px';
          box.textContent = 'Không có kết quả nào khớp với bộ lọc.';
          container.appendChild(box);
        }
      } else {
        const hasNoResultBox = container.querySelector('.filter-empty-box');
        if (hasNoResultBox) hasNoResultBox.remove();
      }
    }

    updateSearchResultsVisibility(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const cards = container.querySelectorAll('.search-result-card');
      cards.forEach(card => {
        const sourceKey = card.getAttribute('data-source-key');
        if (this.popup.disabledSearchSites && this.popup.disabledSearchSites.includes(sourceKey)) {
          card.style.display = 'none';
        } else {
          // Re-evaluate filters too
          const activeRadio = document.querySelector(`input[name="${containerId === 'nsfw-search-results' ? 'nsfw-search-filter-type' : 'search-filter-type'}"]:checked`);
          const filterVal = activeRadio ? activeRadio.value : 'all';
          const queryInput = containerId === 'nsfw-search-results' ? this.nsfwSearchInput : this.mangaSearchInput;
          const query = queryInput ? queryInput.value : '';
          
          const titleEl = card.querySelector('.search-result-title');
          const authorEl = card.querySelector('.search-result-author');
          const title = titleEl ? titleEl.textContent.toLowerCase() : '';
          const author = authorEl ? authorEl.textContent.toLowerCase() : '';

          let matches = true;
          const cleanQuery = query.toLowerCase().trim();
          if (cleanQuery) {
            if (filterVal === 'title') {
              matches = title.includes(cleanQuery);
            } else if (filterVal === 'author') {
              matches = author.includes(cleanQuery);
            } else {
              matches = title.includes(cleanQuery) || author.includes(cleanQuery);
            }
          }
          card.style.display = matches ? 'flex' : 'none';
        }
      });
    }

    checkSearchCompletion() {
      if (this.defaultSearchFinished && this.activeCustomSearchesCount === 0) {
        if (this.mangaSearchLoading) this.mangaSearchLoading.style.display = 'none';
        this.updateSearchResultsVisibility('manga-search-results');
        
        const hasCards = this.mangaSearchResults.querySelectorAll('.search-result-card').length > 0;
        if (!hasCards && !this.currentSearchHasResults) {
          this.popup.clearElement(this.mangaSearchResults);
          const box = document.createElement('div');
          box.style.textAlign = 'center';
          box.style.color = 'var(--text-secondary)';
          box.style.padding = '40px 20px';
          box.textContent = 'Không tìm thấy kết quả nào.';
          this.mangaSearchResults.appendChild(box);
        }
      }
    }

    checkNsfwSearchCompletion() {
      if (this.nsfwSearchFinished && this.activeNsfwCustomSearchesCount === 0) {
        if (this.nsfwSearchLoading) this.nsfwSearchLoading.style.display = 'none';
        this.updateSearchResultsVisibility('nsfw-search-results');

        const hasCards = this.nsfwSearchResults.querySelectorAll('.search-result-card').length > 0;
        if (!hasCards && !this.currentNsfwSearchHasResults) {
          this.popup.clearElement(this.nsfwSearchResults);
          const box = document.createElement('div');
          box.style.textAlign = 'center';
          box.style.color = 'var(--text-secondary)';
          box.style.padding = '40px 20px';
          box.textContent = 'Không tìm thấy kết quả nào.';
          this.nsfwSearchResults.appendChild(box);
        }
      }
    }

    async performMangaSearch() {
      const query = Security.toSafeString(this.mangaSearchInput.value, 100);
      if (!query) return;

      this.mangaSearchLoading.style.display = 'block';
      this.popup.clearElement(this.mangaSearchResults);

      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        this.mangaSearchLoading.style.display = 'none';
        this.popup.showBox(this.mangaSearchResults, 'Trình duyệt không hỗ trợ tìm kiếm trực tiếp.');
        return;
      }

      const searchId = Math.random().toString(36).substring(2, 15);
      this.currentSearchId = searchId;
      this.currentSearchHasResults = false;
      this.defaultSearchFinished = false;
      this.activeCustomSearchesCount = 0;

      const targetSites = Object.keys(this.popup.allSites).filter(key => {
        const site = this.popup.allSites[key];
        if (site.isNsfw) return false;
        const isSearchable = Boolean(site.searchSupported) || Boolean(site.searchUrl && site.searchResultSelector);
        return isSearchable && !this.popup.disabledSearchSites.includes(key);
      });

      // Send to background service worker for fast search provider processing
      chrome.runtime.sendMessage({
        type: 'SEARCH_MANGA',
        data: { query, searchId, targetSites, isNsfw: false }
      }, response => {
        if (!response || !response.success) {
          console.warn('Failed to start background search:', response && response.error);
          if (this.currentSearchId === searchId) {
            this.defaultSearchFinished = true;
            this.checkSearchCompletion();
          }
        }
      });

      // Query custom searchable websites in parallel using offscreen parser fallback
      Object.entries(this.popup.allSites).forEach(([key, site]) => {
        const isDefault = ['mangadex', 'mangakatana', 'urimana', 'theblank', 'twmanga', 'mangaball', 'naverwebtoon', 'mangaplaza', 'baozimh', 'ebookrenta'].includes(key);
        if (isDefault) return; // Background worker handles defaults
        if (site.isNsfw) return;
        if (this.popup.disabledSearchSites.includes(key)) return;

        if (site.searchUrl && site.searchResultSelector) {
          this.activeCustomSearchesCount++;

          (async () => {
            try {
              const fetchUrl = site.searchUrl.replace('{query}', encodeURIComponent(query));
              chrome.runtime.sendMessage({
                type: 'FETCH_HTML',
                data: { url: fetchUrl, referer: site.referer || fetchUrl }
              }, fetchRes => {
                if (this.currentSearchId !== searchId) return;

                this.activeCustomSearchesCount = Math.max(0, this.activeCustomSearchesCount - 1);

                if (fetchRes && !fetchRes.success) {
                  const errorStr = String(fetchRes.error || '').toLowerCase();
                  const isCf = errorStr.includes('cloudflare') || errorStr.includes('challenge') || errorStr.includes('captcha') || errorStr.includes('bot protection') || errorStr.includes('access denied');
                  if (isCf) {
                    this.handleSearchCloudflareBlocked({
                      siteKey: key,
                      sourceName: site.name,
                      url: fetchUrl
                    }, this.mangaSearchResults);
                  }
                  this.checkSearchCompletion();
                  return;
                }

                if (fetchRes && fetchRes.html) {
                  const parsed = this.parseCustomSearchHtml(fetchRes.html, site, key, fetchUrl);
                  if (parsed && parsed.length > 0) {
                    this.currentSearchHasResults = true;
                    parsed.forEach(item => this.renderSearchResult(item, this.mangaSearchResults, false));
                  }
                }
                this.checkSearchCompletion();
              });
            } catch (e) {
              this.activeCustomSearchesCount = Math.max(0, this.activeCustomSearchesCount - 1);
              this.checkSearchCompletion();
            }
          })();
        }
      });

      this.checkSearchCompletion();
    }

    async performNsfwSearch() {
      const query = Security.toSafeString(this.nsfwSearchInput.value, 100);
      if (!query) return;

      this.nsfwSearchLoading.style.display = 'block';
      this.popup.clearElement(this.nsfwSearchResults);

      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        this.nsfwSearchLoading.style.display = 'none';
        this.popup.showBox(this.nsfwSearchResults, 'Trình duyệt không hỗ trợ tìm kiếm trực tiếp.');
        return;
      }

      const searchId = Math.random().toString(36).substring(2, 15);
      this.currentNsfwSearchId = searchId;
      this.currentNsfwSearchHasResults = false;
      this.nsfwSearchFinished = false;
      this.activeNsfwCustomSearchesCount = 0;

      const targetSites = Object.keys(this.popup.allSites).filter(key => {
        const site = this.popup.allSites[key];
        if (!site.isNsfw) return false;
        const isSearchable = Boolean(site.searchSupported) || Boolean(site.searchUrl && site.searchResultSelector);
        return isSearchable && !this.popup.disabledSearchSites.includes(key);
      });

      chrome.runtime.sendMessage({
        type: 'SEARCH_MANGA',
        data: { query, searchId, targetSites, isNsfw: true }
      }, response => {
        if (!response || !response.success) {
          console.warn('Failed to start background NSFW search:', response && response.error);
          if (this.currentNsfwSearchId === searchId) {
            this.nsfwSearchFinished = true;
            this.checkNsfwSearchCompletion();
          }
        }
      });

      Object.entries(this.popup.allSites).forEach(([key, site]) => {
        const isDefault = ['mangadex', 'mangakatana', 'urimana', 'theblank', 'twmanga', 'mangaball', 'naverwebtoon', 'mangaplaza', 'baozimh', 'ebookrenta'].includes(key);
        if (isDefault) return;
        if (!site.isNsfw) return;
        if (this.popup.disabledSearchSites.includes(key)) return;

        if (site.searchUrl && site.searchResultSelector) {
          this.activeNsfwCustomSearchesCount++;

          (async () => {
            try {
              const fetchUrl = site.searchUrl.replace('{query}', encodeURIComponent(query));
              chrome.runtime.sendMessage({
                type: 'FETCH_HTML',
                data: { url: fetchUrl, referer: site.referer || fetchUrl }
              }, fetchRes => {
                if (this.currentNsfwSearchId !== searchId) return;

                this.activeNsfwCustomSearchesCount = Math.max(0, this.activeNsfwCustomSearchesCount - 1);

                if (fetchRes && !fetchRes.success) {
                  const errorStr = String(fetchRes.error || '').toLowerCase();
                  const isCf = errorStr.includes('cloudflare') || errorStr.includes('challenge') || errorStr.includes('captcha') || errorStr.includes('bot protection') || errorStr.includes('access denied');
                  if (isCf) {
                    this.handleSearchCloudflareBlocked({
                      siteKey: key,
                      sourceName: site.name,
                      url: fetchUrl
                    }, this.nsfwSearchResults);
                  }
                  this.checkNsfwSearchCompletion();
                  return;
                }

                if (fetchRes && fetchRes.html) {
                  const parsed = this.parseCustomSearchHtml(fetchRes.html, site, key, fetchUrl);
                  if (parsed && parsed.length > 0) {
                    this.currentNsfwSearchHasResults = true;
                    parsed.forEach(item => this.renderSearchResult(item, this.nsfwSearchResults, true));
                  }
                }
                this.checkNsfwSearchCompletion();
              });
            } catch (e) {
              this.activeNsfwCustomSearchesCount = Math.max(0, this.activeNsfwCustomSearchesCount - 1);
              this.checkNsfwSearchCompletion();
            }
          })();
        }
      });

      this.checkNsfwSearchCompletion();
    }

    parseCustomSearchHtml(html, site, siteKey, searchUrl) {
      const results = [];
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const items = doc.querySelectorAll(site.searchResultSelector);

        items.forEach(el => {
          try {
            const titleEl = site.searchTitleSelector ? el.querySelector(site.searchTitleSelector) : el.querySelector('a');
            if (!titleEl) return;
            const titleText = Security.toSafeString(titleEl.textContent, 180);
            
            let urlVal = titleEl.getAttribute('href') || '';
            if (urlVal && !urlVal.startsWith('http')) {
              const baseOrigin = new URL(searchUrl).origin;
              urlVal = baseOrigin + (urlVal.startsWith('/') ? '' : '/') + urlVal;
            }
            const cleanUrl = Security.normalizeUrl(urlVal, { allowHttp: true });
            if (!cleanUrl) return;

            const coverEl = site.searchCoverSelector ? el.querySelector(site.searchCoverSelector) : el.querySelector('img');
            let coverUrl = '';
            if (coverEl) {
              coverUrl = coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || coverEl.getAttribute('data-original') || '';
              if (coverUrl && !coverUrl.startsWith('http')) {
                const baseOrigin = new URL(searchUrl).origin;
                coverUrl = baseOrigin + (coverUrl.startsWith('/') ? '' : '/') + coverUrl;
              }
            }

            let authorText = 'Nhiều tác giả';
            if (site.searchAuthorSelector) {
              const authorEl = el.querySelector(site.searchAuthorSelector);
              if (authorEl) authorText = Security.toSafeString(authorEl.textContent, 160);
            }

            results.push({
              title: titleText,
              url: cleanUrl,
              thumbnail: Security.normalizeUrl(coverUrl, { allowHttp: true }),
              author: authorText,
              source: site.name,
              sourceKey: siteKey
            });
          } catch (e) {
            console.warn('Failed to parse search card:', e);
          }
        });
      } catch (err) {
        console.error('Custom search HTML parse failed:', err);
      }
      return results;
    }

    renderSearchResult(rawItem, container, isNsfw) {
      const item = Security.normalizeSearchResult(rawItem);
      if (!item) return;

      // Prevent duplicate search result cards
      if (container.querySelector(`.search-result-card[data-url="${item.url}"]`)) return;

      const card = document.createElement('div');
      card.className = 'search-result-card';
      card.style.cursor = 'pointer';
      
      // Staggered entry animation delay based on index in container
      const childCount = container.querySelectorAll('.search-result-card').length;
      card.style.animationDelay = `${childCount * 25}ms`;
      
      card.setAttribute('data-source-key', item.sourceKey);
      card.setAttribute('data-url', item.url);
      
      // Filter out if currently deselected
      if (this.popup.disabledSearchSites.includes(item.sourceKey)) {
        card.style.display = 'none';
      }

      const img = document.createElement('img');
      img.className = 'search-result-cover';
      img.alt = 'cover';
      img.src = item.thumbnail || chrome.runtime.getURL('icons/icon48.png');
      img.addEventListener('error', () => {
        img.src = chrome.runtime.getURL('icons/icon48.png');
      }, { once: true });

      const info = document.createElement('div');
      info.className = 'search-result-info';
      const title = document.createElement('div');
      title.className = 'search-result-title';
      title.title = item.title;
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'search-result-meta';
      const source = document.createElement('span');
      source.className = `search-result-source ${item.sourceKey}`;

      const sourceLogo = document.createElement('img');
      sourceLogo.className = 'search-result-source-logo';
      let sourceDomain = 'mangadex.org';
      try {
        if (item.url) sourceDomain = new URL(item.url).hostname;
      } catch (_) {}
      sourceLogo.src = `https://www.google.com/s2/favicons?sz=32&domain=${sourceDomain}`;
      sourceLogo.addEventListener('error', () => {
        sourceLogo.style.display = 'none';
      }, { once: true });

      source.append(sourceLogo, document.createTextNode(item.source));

      const author = document.createElement('span');
      author.className = 'search-result-author';
      author.title = item.author;
      author.textContent = item.author;
      
      meta.append(source, author);
      info.append(title, meta);

      const openBtn = this.popup.makeIconButton('btn-icon open-btn search-result-open', 'Mở truyện', this.popup.ICONS.open);
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.popup.safeOpenUrl(item.url);
      });

      card.append(img, info, openBtn);
      card.addEventListener('click', () => {
        this.popup.safeOpenUrl(item.url);
      });

      const emptyBox = container.querySelector('div[style*="text-align: center"]');
      if (emptyBox && (emptyBox.textContent.includes('Nhập từ khóa') || emptyBox.textContent.includes('Không tìm thấy'))) {
        this.popup.clearElement(container);
      }

      container.appendChild(card);
      this.updateSearchResultsVisibility(isNsfw ? 'nsfw-search-results' : 'manga-search-results');
    }

    handleSearchCloudflareBlocked(data, container) {
      const key = `cf_${data.siteKey}_${Date.now()}`;
      const card = document.createElement('div');
      card.className = 'search-result-card cloudflare-blocked';
      card.setAttribute('data-source-key', data.siteKey);

      if (this.popup.disabledSearchSites.includes(data.siteKey)) {
        card.style.display = 'none';
      }

      const img = document.createElement('img');
      img.className = 'search-result-cover';
      img.src = chrome.runtime.getURL('icons/icon48.png');

      const info = document.createElement('div');
      info.className = 'search-result-info';
      const title = document.createElement('div');
      title.className = 'search-result-title';
      title.style.color = '#f59e0b';
      title.textContent = `Bị chặn bởi Cloudflare: ${data.sourceName}`;

      const meta = document.createElement('div');
      meta.className = 'search-result-meta';
      const source = document.createElement('span');
      source.className = `search-result-source ${data.siteKey}`;
      source.style.background = 'rgba(245, 158, 11, 0.15)';
      source.style.color = '#fbbf24';
      source.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      source.textContent = data.sourceName;

      meta.append(source);
      info.append(title, meta);

      const verifyBtn = document.createElement('button');
      verifyBtn.type = 'button';
      verifyBtn.className = 'btn-cloudflare-verify';
      verifyBtn.innerHTML = `Vượt CF ${this.popup.ICONS.open}`;
      verifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.popup.safeOpenUrl(data.url);
      });

      card.append(img, info, verifyBtn);

      const emptyBox = container.querySelector('div[style*="text-align: center"]');
      if (emptyBox && emptyBox.textContent.includes('Nhập từ khóa')) {
        this.popup.clearElement(container);
      }

      container.appendChild(card);
    }
  }

  root.SearchManager = new SearchManager();
})(typeof globalThis !== 'undefined' ? globalThis : this);
