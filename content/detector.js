// Content Script Heuristic and DOM Scanning Detector Module
(function (root) {
  'use strict';

  const Security = root.MangaSecurity || {};
  const BRIDGE_ID = '__manga_dl_bridge__';
  const MAX_DOM_SNAPSHOT_CHARS = 250000;

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

  function detectBotWall() {
    const title = document.title || '';
    if (title.includes('Just a moment...') || title.includes('Cloudflare') || title.includes('DDOS-GUARD') || title.includes('Checking your browser')) {
      return { detected: true, type: 'Cloudflare/DDOS-Guard Challenge Page' };
    }
    if (document.querySelector('#challenge-running, #challenge-form, .cf-challenge, #cf-bubble, #cf-error-details, #captcha-container')) {
      return { detected: true, type: 'Cloudflare/Anti-Bot Challenge Form' };
    }
    if (document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="hcaptcha.com"], iframe[src*="recaptcha"]')) {
      return { detected: true, type: 'Cloudflare Turnstile or CAPTCHA widget' };
    }
    if (document.querySelector('#g-recaptcha, .g-recaptcha, #h-captcha, .h-captcha')) {
      return { detected: true, type: 'CAPTCHA widget' };
    }
    return { detected: false };
  }

  function detectSiteType() {
    const html = document.documentElement.outerHTML || '';
    const host = window.location.hostname.toLowerCase();
    
    // 1. WordPress (Madara, MangaReader, Blogspot, etc.)
    if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('wp-json')) {
      if (document.querySelector('.wp-manga, .wp-manga-chapter-img') || html.includes('wp-manga')) {
        return { type: 'WordPress (Madara Manga Theme)', framework: 'WordPress' };
      }
      if (document.querySelector('.readerarea, .ts-main-image, #ts-reader') || html.includes('readerarea') || html.includes('ts-reader')) {
        return { type: 'WordPress (MangaStream/MangaReader Theme)', framework: 'WordPress' };
      }
      return { type: 'WordPress Site (Generic)', framework: 'WordPress' };
    }
    
    // 2. Blogger / Blogspot
    if (host.includes('blogspot.com') || html.includes('blogger.com') || html.includes('blogspot.com')) {
      return { type: 'Blogger / Blogspot CMS', framework: 'Blogger' };
    }



    // 4. NetTruyen / NhatTruyen Clone Platform (Popular custom framework in Vietnam)
    if (document.querySelector('.reading-detail, .page-chapter') || html.includes('reading-detail') || html.includes('page-chapter')) {
      return { type: 'NetTruyen / NhatTruyen Custom CMS', framework: 'NetTruyen Clone' };
    }

    // 5. Next.js / Nuxt.js (modern SPAs)
    if (html.includes('__next') || html.includes('id="__next"') || html.includes('data-reactroot')) {
      return { type: 'Next.js React SPA', framework: 'React' };
    }
    if (html.includes('__nuxt') || html.includes('id="__nuxt"')) {
      return { type: 'Nuxt.js Vue SPA', framework: 'Vue' };
    }

    return { type: 'Generic / Custom DOM Site', framework: 'Unknown' };
  }

  function probeMangaImages() {
    const allImgs = Array.from(document.querySelectorAll('img'));
    const parentMap = new Map();

    allImgs.forEach(img => {
      const src = img.src || '';
      const id = img.id || '';
      const className = img.className || '';
      const srcLower = src.toLowerCase();

      if (/logo|avatar|icon|social|banner|ad-|advertisement|widget|fb-|share|comment|star|nav|menu|user|profile/i.test(id + className)) {
        return;
      }
      if (srcLower && /logo|avatar|icon|social|banner|advertisement|nav|menu|loader|spinner|placeholder/i.test(srcLower)) {
        let hasLazyAttr = false;
        for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'data-lazy', 'data-srcset']) {
          if (img.getAttribute(attr)) {
            hasLazyAttr = true;
            break;
          }
        }
        if (!hasLazyAttr) return;
      }

      let parent = img.parentElement;
      let depth = 0;
      while (parent && depth < 3) {
        const tag = parent.tagName.toLowerCase();
        if (tag === 'body' || tag === 'html' || tag === 'script' || tag === 'style') break;
        
        if (!parentMap.has(parent)) {
          parentMap.set(parent, { element: parent, imgs: [], score: 0 });
        }
        parentMap.get(parent).imgs.push(img);
        parent = parent.parentElement;
        depth++;
      }
    });

    parentMap.forEach((data, parent) => {
      const imgs = data.imgs;
      if (imgs.length < 3) return;

      let score = imgs.length * 10;
      const id = parent.id || '';
      const className = parent.className || '';
      const tag = parent.tagName.toLowerCase();

      if (/reader|viewer|chapter|content|manga|images|page|vung-doc|reading|book|detail/i.test(id + className)) {
        score += 150;
      }
      if (tag === 'main' || tag === 'article' || tag === 'section') {
        score += 50;
      }

      if (/header|footer|sidebar|comment|nav|menu|widget|reply|social/i.test(id + className)) {
        score -= 200;
      }

      data.score = score;
    });

    let bestContainerData = null;
    parentMap.forEach(data => {
      if (!bestContainerData || data.score > bestContainerData.score) {
        bestContainerData = data;
      }
    });

    if (!bestContainerData || bestContainerData.imgs.length < 3) {
      return null;
    }

    const container = bestContainerData.element;
    const containerImgs = bestContainerData.imgs;

    let selector = '';
    const containerId = container.id;
    const containerClass = container.className ? container.className.split(/\s+/)[0] : '';

    if (containerId && !/^[0-9]/.test(containerId)) {
      selector = `#${containerId} img`;
    } else if (containerClass && !containerClass.includes(':') && !containerClass.includes(' ')) {
      selector = `.${containerClass} img`;
    } else {
      selector = `${container.tagName.toLowerCase()} img`;
    }

    const imgClasses = new Set();
    containerImgs.forEach(img => {
      if (img.className) {
        img.className.split(/\s+/).forEach(c => {
          if (c && !c.includes(':')) imgClasses.add(c);
        });
      }
    });

    if (imgClasses.size === 1) {
      const imgClass = Array.from(imgClasses)[0];
      if (containerId && !/^[0-9]/.test(containerId)) {
        selector = `#${containerId} img.${imgClass}`;
      } else if (containerClass && !containerClass.includes(':')) {
        selector = `.${containerClass} img.${imgClass}`;
      } else {
        selector = `img.${imgClass}`;
      }
    }

    const possibleAttributes = ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'data-lazy', 'src'];
    const attrScores = {};
    possibleAttributes.forEach(attr => attrScores[attr] = 0);

    containerImgs.forEach(img => {
      possibleAttributes.forEach(attr => {
        const val = img.getAttribute(attr);
        if (val) {
          const safeVal = Security.normalizeUrl(val, { baseUrl: window.location.href, allowHttp: true, allowProtocolRelative: true });
          if (safeVal && !safeVal.includes('placeholder') && !safeVal.includes('spacer') && !safeVal.includes('loader') && safeVal.length > 10) {
            attrScores[attr] += 1;
          }
        }
      });
    });

    let bestAttr = 'src';
    let maxAttrScore = 0;
    Object.keys(attrScores).forEach(attr => {
      if (attrScores[attr] > maxAttrScore) {
        maxAttrScore = attrScores[attr];
        bestAttr = attr;
      }
    });

    let imageUrlAttr = bestAttr;
    if (bestAttr !== 'src' && attrScores['src'] > 0) {
      imageUrlAttr = `${bestAttr}|src`;
    }

    return {
      selector,
      attribute: imageUrlAttr,
      imageCount: containerImgs.length
    };
  }

  function probeMangaMetadata() {
    const docTitle = document.title || '';
    const allHeaders = Array.from(document.querySelectorAll('h1, h2, h3, .manga-title, .title, .name'));

    let bestTitleEl = null;
    let bestTitleScore = -1;

    allHeaders.forEach(el => {
      const text = el.textContent.trim();
      if (!text || text.length > 100) return;

      let score = 0;
      if (el.tagName === 'H1') score += 50;
      if (el.tagName === 'H2') score += 30;

      if (/manga-title|title|name|item-title/i.test(el.className + el.id)) score += 30;

      const docTitleWords = docTitle.toLowerCase().split(/[^a-z0-9]+/);
      const textWords = text.toLowerCase().split(/[^a-z0-9]+/);

      let overlap = 0;
      textWords.forEach(word => {
        if (word && docTitleWords.includes(word)) overlap++;
      });
      score += overlap * 20;

      if (score > bestTitleScore) {
        bestTitleScore = score;
        bestTitleEl = el;
      }
    });

    let titleSelector = '';
    if (bestTitleEl) {
      if (bestTitleEl.id && !/^[0-9]/.test(bestTitleEl.id)) {
        titleSelector = `#${bestTitleEl.id}`;
      } else if (bestTitleEl.className) {
        titleSelector = `.${bestTitleEl.className.split(/\s+/)[0]}`;
      } else {
        titleSelector = bestTitleEl.tagName.toLowerCase();
      }
    }

    const allChapElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, .chapter-title, .chapter, .breadcrumb li.active, .breadcrumb li:last-child'));
    let bestChapEl = null;
    let bestChapScore = -1;

    allChapElements.forEach(el => {
      const text = el.textContent.trim();
      if (!text || text.length > 80) return;

      let score = 0;
      if (/chapter|chương|chap|ep|episode/i.test(text)) {
        score += 100;
      }
      if (/\d+/.test(text)) {
        score += 30;
      }
      if (/chapter|chap/i.test(el.className + el.id)) {
        score += 50;
      }

      if (score > bestChapScore) {
        bestChapScore = score;
        bestChapEl = el;
      }
    });

    let chapterSelector = '';
    if (bestChapEl) {
      if (bestChapEl.id && !/^[0-9]/.test(bestChapEl.id)) {
        chapterSelector = `#${bestChapEl.id}`;
      } else if (bestChapEl.className) {
        chapterSelector = `.${bestChapEl.className.split(/\s+/)[0]}`;
      } else {
        chapterSelector = bestChapEl.tagName.toLowerCase();
      }
    }

    return {
      titleSelector: titleSelector || 'h1',
      chapterSelector: chapterSelector || 'h2',
      titleText: bestTitleEl ? bestTitleEl.textContent.trim() : '',
      chapterText: bestChapEl ? bestChapEl.textContent.trim() : ''
    };
  }

  function getBestCaptureRoot() {
    const state = getSharedState();
    const candidates = [];
    if (state.matchedSite && state.matchedSite.imageSelector) {
      try {
        const firstImage = document.querySelector(state.matchedSite.imageSelector);
        if (firstImage) {
          candidates.push(firstImage.closest('main, article, .reader, .viewer, .chapter, .chapter-content, .manga-reader, body') || firstImage.parentElement);
        }
      } catch (error) {
        // Ignored
      }
    }

    document.querySelectorAll('main, article, .reader, .viewer, .chapter, .chapter-content, .manga-reader, #reader, #viewer, body').forEach(el => {
      if (el) candidates.push(el);
    });

    let best = document.body;
    let bestScore = -1;
    candidates.forEach(el => {
      if (!el) return;
      const imgCount = el.querySelectorAll ? el.querySelectorAll('img').length : 0;
      const textScore = Math.min((el.textContent || '').length, 1000) / 1000;
      const score = imgCount * 10 + textScore;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });
    return best || document.body;
  }

  function annotateCandidates(clone, root) {
    // 1. Manga images candidate
    let imagesSelector = '';
    let imagesAttr = '';
    try {
      const imgProbed = probeMangaImages();
      if (imgProbed && imgProbed.selector) {
        imagesSelector = imgProbed.selector;
        imagesAttr = imgProbed.attribute;
      }
    } catch (e) {
      console.warn('Failed to probe images for annotation:', e);
    }

    if (imagesSelector) {
      try {
        const nodes = clone.querySelectorAll(imagesSelector);
        nodes.forEach(img => {
          img.setAttribute('data-ai-role', 'manga-image-candidate');
          if (imagesAttr) {
            img.setAttribute('data-ai-attr-candidate', imagesAttr);
          }
          // Also mark the container parent
          const parent = img.closest('main, article, .reader, .viewer, .chapter, .chapter-content, .manga-reader, div');
          if (parent && parent !== clone) {
            parent.setAttribute('data-ai-role', 'manga-image-container-candidate');
          }
        });
      } catch (e) {}
    }

    // 2. Metadata candidate (Title and Chapter)
    try {
      const meta = probeMangaMetadata();
      if (meta) {
        if (meta.titleSelector) {
          const el = clone.querySelector(meta.titleSelector);
          if (el) el.setAttribute('data-ai-role', 'manga-title-candidate');
        }
        if (meta.chapterSelector) {
          const el = clone.querySelector(meta.chapterSelector);
          if (el) el.setAttribute('data-ai-role', 'manga-chapter-candidate');
        }
      }
    } catch (e) {}

    // 3. Search inputs & forms candidate
    try {
      clone.querySelectorAll('input').forEach(input => {
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        if (['text', 'search'].includes(type)) {
          const id = (input.id || '').toLowerCase();
          const name = (input.getAttribute('name') || '').toLowerCase();
          const className = (input.className || '').toLowerCase();
          const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
          if (/search|find|query|keyword|tim-kiem|timkiem|\bs\b/i.test(id + name + className + placeholder)) {
            input.setAttribute('data-ai-role', 'search-input-candidate');
            const form = input.closest('form');
            if (form) {
              form.setAttribute('data-ai-role', 'search-form-candidate');
            }
          }
        }
      });
    } catch (e) {}

    // 4. Search results candidate (list items, title, cover)
    try {
      clone.querySelectorAll('*').forEach(el => {
        const tag = el.tagName.toLowerCase();
        if (['div', 'li', 'tr', 'article', 'section'].includes(tag)) {
          const links = el.querySelectorAll('a');
          const imgs = el.querySelectorAll('img');
          if (links.length >= 1 && imgs.length >= 1) {
            const parent = el.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children);
              let similarSiblings = 0;
              siblings.forEach(sib => {
                const subLinks = sib.querySelectorAll('a');
                const subImgs = sib.querySelectorAll('img');
                if (subLinks.length >= 1 && subImgs.length >= 1) {
                  similarSiblings++;
                }
              });
              if (similarSiblings >= 3) {
                el.setAttribute('data-ai-role', 'search-result-item-candidate');
                
                // Find first link with text
                const titleLink = Array.from(links).find(a => a.textContent.trim().length > 2);
                if (titleLink) {
                  titleLink.setAttribute('data-ai-role', 'search-result-title-candidate');
                }
                // Find cover img
                if (imgs[0]) {
                  imgs[0].setAttribute('data-ai-role', 'search-result-cover-candidate');
                }
                
                // Also mark the container parent
                if (parent !== clone) {
                  parent.setAttribute('data-ai-role', 'search-results-container-candidate');
                }
              }
            }
          }
        }
      });
    } catch (e) {}
  }

  function collapseRepetitiveSiblings(parent) {
    const children = Array.from(parent.children);
    if (children.length <= 4) {
      children.forEach(collapseRepetitiveSiblings);
      return;
    }

    const counts = {};
    const toRemove = [];

    children.forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (['input', 'select', 'textarea', 'button', 'form'].includes(tag)) {
        collapseRepetitiveSiblings(child);
        return;
      }

      let signature = tag;
      if (child.className) {
        const classes = child.className.trim().split(/\s+/).filter(Boolean).sort();
        if (classes.length > 0) {
          signature += '.' + classes.join('.');
        }
      }

      counts[signature] = (counts[signature] || 0) + 1;

      if (counts[signature] > 3) {
        toRemove.push({ child, signature });
      } else {
        collapseRepetitiveSiblings(child);
      }
    });

    const collapsedStats = {};
    toRemove.forEach(({ child, signature }) => {
      collapsedStats[signature] = (collapsedStats[signature] || 0) + 1;
      child.remove();
    });

    Object.entries(collapsedStats).forEach(([sig, count]) => {
      const comment = document.createComment(` COLLAPSED: ${count} similar ${sig} element(s) `);
      parent.appendChild(comment);
    });
  }

  function sanitizeDomClone(root) {
    const clone = root.cloneNode(true);

    // Strip comments from the clone
    try {
      const iterator = document.createNodeIterator(clone, NodeFilter.SHOW_COMMENT);
      let commentNode;
      const commentsToRemove = [];
      while ((commentNode = iterator.nextNode())) {
        commentsToRemove.push(commentNode);
      }
      commentsToRemove.forEach(node => node.remove());
    } catch (e) {
      console.warn('Failed to strip comments:', e);
    }

    // Keep form, input, textarea, select, and button elements, but remove script/style tags and password fields, SVGs, paths, etc., as well as common ad and tracking elements
    clone.querySelectorAll('script, style, iframe, object, embed, noscript, link, meta, input[type="password"], svg, path, symbol, g, use, rect, circle, polyline, polygon, line, mask, clippath, defs, linearGradient, radialGradient, stop, .adsbygoogle, [class*="advertising"], [class*="-ad-"], [class*=" ads "], [id*="google_ads"], [class*="social-share"], [class*="fb-comments"], [class*="disqus"], #disqus_thread, #comments, .comments, .comment-respond, #respond').forEach(el => el.remove());

    const attributeWhitelist = [
      'id', 'class', 'src', 'href', 'title', 'alt', 'placeholder', 'type', 
      'name', 'action', 'method', 'data-src', 'data-original', 'data-lazy-src', 
      'data-ai-role', 'data-ai-attr-candidate'
    ];

    clone.querySelectorAll('*').forEach(el => {
      // Clear input/textarea values to protect user privacy while preserving selectors/attributes
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'input') {
        el.removeAttribute('value');
        el.value = '';
      } else if (tagName === 'textarea') {
        el.removeAttribute('value');
        el.value = '';
        el.textContent = '';
      } else if (tagName === 'option') {
        el.removeAttribute('value');
      }

      // Filter and sanitize attributes based on whitelist
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (!attributeWhitelist.includes(name)) {
          el.removeAttribute(attr.name);
          return;
        }
        if (['src', 'href', 'data-src', 'data-original', 'data-lazy-src'].includes(name)) {
          const sanitized = Security.sanitizeUrlForReport(attr.value);
          if (sanitized) {
            el.setAttribute(attr.name, sanitized);
          } else {
            el.removeAttribute(attr.name);
          }
          return;
        }
        if (attr.value.length > 240) {
          el.setAttribute(attr.name, Security.redactSecrets(attr.value).slice(0, 240));
        }
      });
    });

    // Clean up empty tags that don't have text or useful attributes
    clone.querySelectorAll('span, div, p, i, b, strong, em').forEach(el => {
      if (el.childNodes.length === 0 && (!el.id) && (!el.className)) {
        el.remove();
      }
    });

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      node.nodeValue = Security.redactSecrets(node.nodeValue).slice(0, 500);
    });

    // Annotate candidates in the cloned tree
    annotateCandidates(clone, root);

    // Collapse repetitive sibling groups to keep HTML compact
    collapseRepetitiveSiblings(clone);

    return clone;
  }

  function captureSanitizedDomSnapshot() {
    const state = getSharedState();
    const root = document.body || getBestCaptureRoot();
    const clone = sanitizeDomClone(root);
    const html = clone.outerHTML.slice(0, MAX_DOM_SNAPSHOT_CHARS);
    return {
      capturedAt: new Date().toISOString(),
      pageTitle: Security.toSafeString(document.title, 200),
      url: Security.sanitizeUrlForReport(window.location.href),
      hostname: window.location.hostname,
      path: window.location.pathname.slice(0, 300),
      sourceKey: state.matchedKey || '',
      sourceName: state.matchedSite ? Security.toSafeString(state.matchedSite.name, 120) : '',
      rootTag: root.tagName ? root.tagName.toLowerCase() : '',
      imageCount: root.querySelectorAll ? root.querySelectorAll('img').length : 0,
      truncated: clone.outerHTML.length > MAX_DOM_SNAPSHOT_CHARS,
      html
    };
  }

  function generateErrorReport(errorContext) {
    const state = getSharedState();
    const docTitle = document.title || '';
    const currentUrl = window.location.href;
    const currentHost = window.location.hostname;
    const botWall = detectBotWall();
    const totalImgs = document.querySelectorAll('img').length;

    let probedImages = null;
    try {
      probedImages = probeMangaImages();
    } catch (e) {
      console.warn('Failed to probe images:', e);
    }

    let probedMeta = null;
    try {
      probedMeta = probeMangaMetadata();
    } catch (e) {
      console.warn('Failed to probe metadata:', e);
    }

    let recommendedConfig = null;
    if (probedImages) {
      recommendedConfig = {
        name: state.matchedSite ? state.matchedSite.name : currentHost.replace('www.', ''),
        domainPattern: state.matchedSite ? state.matchedSite.domainPattern : `^.*${currentHost.replace('www.', '').replace(/\\./g, '\\\\.')}$`,
        chapterUrlPattern: state.matchedSite ? state.matchedSite.chapterUrlPattern : ".*",
        imageSelector: probedImages.selector,
        imageUrlAttribute: probedImages.attribute,
        titleSelector: (probedMeta && probedMeta.titleSelector) ? probedMeta.titleSelector : "h1",
        chapterSelector: (probedMeta && probedMeta.chapterSelector) ? probedMeta.chapterSelector : "h2"
      };
    }

    const report = {
      timestamp: new Date().toISOString(),
      url: currentUrl,
      host: currentHost,
      errorContext: errorContext,
      matchedConfig: state.matchedSite ? {
        name: state.matchedSite.name,
        domainPattern: state.matchedSite.domainPattern,
        chapterUrlPattern: state.matchedSite.chapterUrlPattern,
        imageSelector: state.matchedSite.imageSelector,
        imageUrlAttribute: state.matchedSite.imageUrlAttribute,
        titleSelector: state.matchedSite.titleSelector,
        chapterSelector: state.matchedSite.chapterSelector
      } : null,
      pageState: {
        documentTitle: docTitle,
        totalImagesOnPage: totalImgs,
        botWallDetected: botWall.detected ? botWall.type : 'No'
      },
      probedHeuristics: {
        images: probedImages ? {
          selector: probedImages.selector,
          attribute: probedImages.attribute,
          count: probedImages.imageCount
        } : null,
        metadata: probedMeta ? {
          titleSelector: probedMeta.titleSelector,
          chapterSelector: probedMeta.chapterSelector,
          titleText: probedMeta.titleText,
          chapterText: probedMeta.chapterText
        } : null
      },
      aiRecommendation: recommendedConfig
    };

    const markdownReport = `### MANGA DOWNLOADER DIAGNOSTIC REPORT ###
- **URL**: ${report.url}
- **Timestamp**: ${report.timestamp}
- **Error Context**: ${report.errorContext}
- **Current Matched Config**: ${report.matchedConfig ? `\`${report.matchedConfig.name}\`` : 'None'}
- **Page State**:
  - Document Title: "${report.pageState.documentTitle}"
  - Bot Wall: ${report.pageState.botWallDetected}
  - Total Images: ${report.pageState.totalImagesOnPage}
- **Probed Heuristics**:
  - Found Images Selector: ${probedImages ? `\`${probedImages.selector}\`` : 'None'}
  - Found Images Attribute: ${probedImages ? `\`${probedImages.attribute}\`` : 'None'}
  - Found Images Count: ${probedImages ? probedImages.imageCount : 0}
  - Found Title Selector: ${probedMeta ? `\`${probedMeta.titleSelector}\` ("${probedMeta.titleText}")` : 'None'}
  - Found Chapter Selector: ${probedMeta ? `\`${probedMeta.chapterSelector}\` ("${probedMeta.chapterText}")` : 'None'}

- **Recommended Config (copy to AI to fix)**:
\`\`\`json
${JSON.stringify(recommendedConfig || report.matchedConfig || {}, null, 2)}
\`\`\`
`;
    return markdownReport;
  }

  function detectIsNsfw() {
    const host = window.location.hostname.toLowerCase();
    const title = (document.title || '').toLowerCase();
    const metaDesc = (document.querySelector('meta[name="description"]')?.content || '').toLowerCase();
    const metaKeywords = (document.querySelector('meta[name="keywords"]')?.content || '').toLowerCase();
    
    const nsfwKeywords = ['hentai', '18+', 'nsfw', 'adult', 'uncensored', 'smut', 'ecchi', 'yaoi', 'yuri', 'doujinshi', 'truyentranh18', 'sex', 'truyen18', 'hentaivn', 'lustaveland'];
    
    for (const kw of nsfwKeywords) {
      if (host.includes(kw)) return true;
    }
    
    const textToCheck = `${title} ${metaDesc} ${metaKeywords}`;
    let matchCount = 0;
    const matchKeywords = ['hentai', '18+', 'nsfw', 'adult', 'smut', 'yaoi', 'truyện 18', 'truyện 18+', 'truyện người lớn', 'uncensored'];
    for (const kw of matchKeywords) {
      if (textToCheck.includes(kw)) {
        matchCount++;
      }
    }
    
    if (matchCount >= 1) return true;
    
    const bodyText = document.body ? document.body.textContent.toLowerCase().substring(0, 2000) : '';
    if (bodyText.includes('xác nhận bạn đã trên 18 tuổi') || 
        bodyText.includes('truyện dành cho tuổi 18+') || 
        bodyText.includes('adult content') || 
        bodyText.includes('xác nhận 18 tuổi') ||
        bodyText.includes('ảnh hưởng thuần phong mỹ tục')) {
      return true;
    }
    
    return false;
  }

  // Read data from the DOM bridge element
  function readBridge() {
    const state = getSharedState();
    const bridge = document.getElementById(BRIDGE_ID);
    if (bridge && bridge.textContent) {
      try {
        const data = JSON.parse(bridge.textContent);
        const normalized = Security.normalizeUrlArray(data, {
          baseUrl: window.location.href,
          allowBlob: true,
          max: 500
        });
        if (normalized.length > 0 && normalized.length !== state.pageChapterImages.length) {
          state.pageChapterImages = normalized;
          console.log(`Manga Downloader: Intercepted ${state.pageChapterImages.length} images from page context via DOM bridge.`);
        }
      } catch (e) {
        console.warn('Manga Downloader: Failed to parse bridge data', e);
      }
    }
    if (root.MangaUI && root.MangaUI.updateButtonState) {
      root.MangaUI.updateButtonState();
    }
  }

  // Export to global scope
  root.MangaDetector = {
    detectBotWall,
    detectSiteType,
    probeMangaImages,
    probeMangaMetadata,
    captureSanitizedDomSnapshot,
    generateErrorReport,
    detectIsNsfw,
    readBridge
  };
})(typeof window !== 'undefined' ? window : this);
