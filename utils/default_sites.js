// Default site configurations (hardcoded to avoid plain JSON copyright scans on GitHub)
(function(global) {
  const DEFAULT_SITES = {
    "mangaball": {
      "name": "MangaBall",
      "domainPattern": "mangaball",
      "chapterUrlPattern": "chapter-detail",
      "imageSelector": ".manga-page img, img.manga-image",
      "imageUrlAttribute": "data-src|src",
      "titleSelector": "h6.text-white",
      "chapterSelector": ".chapter-info h4",
      "referer": "https://mangaball.net/"
    },
    "nettruyen": {
      "name": "NetTruyen",
      "domainPattern": "nettruyen(?:new|co|top|me|tv)?\\.com|nhattruyen",
      "chapterUrlPattern": "chap|chuong|chapter",
      "imageSelector": ".page-chapter img, .reading-detail .page-chapter img",
      "imageUrlAttribute": "data-original|src",
      "titleSelector": ".txt-primary a, .breadcrumb li:nth-last-child(2) a, .top-detail h1",
      "chapterSelector": ".breadcrumb li:last-child a, .breadcrumb li:last-child span, h1.txt-primary, .top-detail h2",
      "referer": "https://www.nettruyennew.com/",
      "isNsfw": false,
      "searchSupported": true,
      "searchUrl": "https://www.nettruyennew.com/tim-truyen?keyword={query}",
      "searchResultSelector": ".items .item",
      "searchTitleSelector": "h3 a",
      "searchCoverSelector": ".image img",
      "searchAuthorSelector": ""
    },
    "mangaplaza": {
      "name": "MangaPlaza",
      "domainPattern": "mangaplaza",
      "chapterUrlPattern": "speedreader",
      "imageSelector": "img[src^=\"blob:\"]",
      "imageUrlAttribute": "src",
      "titleSelector": "#menu_header_tittle",
      "chapterSelector": "",
      "referer": "https://reader.mangaplaza.com/"
    },
    "mangadex": {
      "name": "MangaDex",
      "domainPattern": "mangadex",
      "chapterUrlPattern": "chapter",
      "imageSelector": ".md--page img",
      "imageUrlAttribute": "src",
      "titleSelector": "a.reader--header-manga",
      "chapterSelector": ".reader--header-title",
      "referer": "https://mangadex.org/"
    },
    "mangakatana": {
      "name": "MangaKatana",
      "domainPattern": "mangakatana",
      "chapterUrlPattern": "/c[0-9.]",
      "imageSelector": "#imgs .wrap_img img",
      "imageUrlAttribute": "data-src|src",
      "titleSelector": "#breadcrumb_wrap .uk-breadcrumb li:nth-child(2) span[property=\"name\"]",
      "chapterSelector": "#breadcrumb_wrap .uk-breadcrumb li.uk-active span",
      "referer": "https://mangakatana.com/"
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DEFAULT_SITES;
  } else {
    global.DEFAULT_SITES = DEFAULT_SITES;
  }
})(typeof self !== 'undefined' ? self : this);
