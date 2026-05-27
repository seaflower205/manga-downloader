// Background Search Fallbacks via Search Engines
(function (root) {
  'use strict';

  const Network = root.BgNetwork || {};
  const Utils = root.BgUtils || {};

  // Bypasses Cloudflare by searching via static Yahoo and parsing result pages
  async function searchViaYahoo(query, siteDomain, siteName, siteKey, signal) {
    const searchUrl = 'https://search.yahoo.com/search?p=site:' + encodeURIComponent(siteDomain) + '+' + encodeURIComponent(query) + '&vm=p&adlt=off';
    try {
      const html = await Network.fetchHtmlWithFallback({ url: searchUrl, referer: 'https://search.yahoo.com/', timeout: 10000, signal });
      const results = [];
      const patterns = [
        /<div class="compTitle[^"]*">[\s\S]*?<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*class="title[^"]*"[^>]*><span[^>]*>([\s\S]*?)<\/span><\/h3>/gi,
        /<a[^>]*class="[^"]*ac-algo[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        /<h3[^>]*class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      ];
      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 15) {
          const rawHref = match[1];
          const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
          const actualUrl = Utils.extractActualYahooUrl(rawHref);
          if (!actualUrl || !actualUrl.includes(siteDomain)) continue;
          if (results.some(r => r.url === actualUrl)) continue;

          const isMangaPage = actualUrl.includes('/manga/') || actualUrl.includes('/manga-detail/') || actualUrl.includes('/chapter-detail/') || actualUrl.includes('/truyen/') || actualUrl.includes('/series/') || actualUrl.includes('/comic/') || actualUrl.includes('/chapter/');
          if (!isMangaPage && (siteDomain === 'theblank.net' || siteDomain === 'mangakatana.com')) continue;

          results.push({
            title: rawTitle,
            author: 'Nhiều tác giả',
            thumbnail: `https://www.google.com/s2/favicons?sz=64&domain=${siteDomain}`,
            url: actualUrl,
            source: siteName,
            sourceKey: siteKey
          });
        }
        if (results.length > 0) break;
      }
      return results;
    } catch (err) {
      console.error('searchViaYahoo error:', err);
      throw err;
    }
  }

  // DuckDuckGo Lite HTML search fallback
  async function searchViaDuckDuckGo(query, siteDomain, siteName, siteKey, signal) {
    const searchUrl = 'https://lite.duckduckgo.com/lite/?q=site:' + encodeURIComponent(siteDomain) + '+' + encodeURIComponent(query) + '&kp=-2';
    try {
      const html = await Network.fetchHtmlWithFallback({ url: searchUrl, referer: 'https://lite.duckduckgo.com/', timeout: 10000, signal });
      const results = [];
      const patterns = [
        /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        /<a[^>]*rel="nofollow"[^>]*class="[^"]*result[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        /<td[^>]*>\s*\d+\.?\s*<\/td>\s*<td[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      ];
      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 15) {
          let rawUrl = match[1].trim();
          const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
          if (!rawTitle) continue;
          
          if (rawUrl.includes('uddg=')) {
            try {
              const uddg = new URL(rawUrl, 'https://duckduckgo.com').searchParams.get('uddg');
              if (uddg) rawUrl = uddg;
            } catch (e) {}
          }
          
          if (!rawUrl.includes(siteDomain)) continue;
          if (results.some(r => r.url === rawUrl)) continue;

          const isMangaPage = rawUrl.includes('/manga/') || rawUrl.includes('/manga-detail/') || rawUrl.includes('/chapter-detail/') || rawUrl.includes('/truyen/') || rawUrl.includes('/series/') || rawUrl.includes('/comic/') || rawUrl.includes('/chapter/');
          if (!isMangaPage && (siteDomain === 'theblank.net' || siteDomain === 'mangakatana.com')) continue;

          results.push({
            title: rawTitle,
            author: 'Nhiều tác giả',
            thumbnail: `https://www.google.com/s2/favicons?sz=64&domain=${siteDomain}`,
            url: rawUrl,
            source: siteName,
            sourceKey: siteKey
          });
        }
        if (results.length > 0) break;
      }
      return results;
    } catch (err) {
      console.error('searchViaDuckDuckGo error:', err);
      throw err;
    }
  }

  // Google HTML search fallback
  async function searchViaGoogle(query, siteDomain, siteName, siteKey, signal) {
    const searchUrl = 'https://www.google.com/search?q=site:' + encodeURIComponent(siteDomain) + '+' + encodeURIComponent(query) + '&num=15';
    try {
      const html = await Network.fetchHtmlWithFallback({ url: searchUrl, referer: 'https://www.google.com/', timeout: 10000, signal });
      const results = [];
      const patterns = [
        /<a[^>]*href="\/url\?q=([^&"]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi,
        /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi
      ];
      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(html)) !== null && results.length < 15) {
          let rawUrl = decodeURIComponent(match[1]).trim();
          const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
          if (!rawTitle) continue;
          if (!rawUrl.includes(siteDomain)) continue;
          if (results.some(r => r.url === rawUrl)) continue;

          const isMangaPage = rawUrl.includes('/manga/') || rawUrl.includes('/manga-detail/') || rawUrl.includes('/chapter-detail/') || rawUrl.includes('/truyen/') || rawUrl.includes('/series/') || rawUrl.includes('/comic/') || rawUrl.includes('/chapter/');
          if (!isMangaPage && (siteDomain === 'theblank.net' || siteDomain === 'mangakatana.com')) continue;

          results.push({
            title: rawTitle,
            author: 'Nhiều tác giả',
            thumbnail: `https://www.google.com/s2/favicons?sz=64&domain=${siteDomain}`,
            url: rawUrl,
            source: siteName,
            sourceKey: siteKey
          });
        }
        if (results.length > 0) break;
      }
      return results;
    } catch (err) {
      console.error('searchViaGoogle error:', err);
      throw err;
    }
  }

  // Export functions
  root.BgSearchFallback = {
    searchViaYahoo,
    searchViaDuckDuckGo,
    searchViaGoogle
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
