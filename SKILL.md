---
name: manga-downloader-site-adder
description: Analyze manga websites to find image/title selectors, update config/sites.json, and verify download functionality.
---

# Manga Downloader Site Adder Skill

This skill guides the AI agent to dynamically analyze new manga websites, extract selectors, and add them to the Manga Downloader site profile database (`config/sites.json`).

## Workflow

### Step 1: Open Target Page using Chrome DevTools
Use the `chrome-devtools-mcp` tools to launch a new browser instance or navigate an existing one to the target manga chapter URL.
- Tool: `chrome_devtools_mcp_new_page` or `chrome_devtools_mcp_navigate_page`
- URL: The target manga chapter URL (e.g. `https://mangaball.net/chapter-detail/...`)

### Step 2: Analyze the DOM (Select Discovery)
Evaluate JavaScript in the browser console using `chrome_devtools_mcp_evaluate_script` to inspect the DOM and identify the key selectors:

1. **Title Selector**: Find the element containing the manga title.
   - Run: `document.querySelector('h1')` or lookup headers, breadcrumbs, etc.
2. **Chapter Selector**: Find the element containing the current chapter name/number.
3. **Image Selector**: Find the image tags that hold the main chapter pages.
   - Run: `Array.from(document.querySelectorAll('img')).map(img => img.src || img.getAttribute('data-src'))`
   - Filter out icons, ads, and avatar images to locate the core chapter pages wrapper (e.g., `.page-chapter img`, `.chapter-content img`, etc.).
4. **Image URL Attribute**: Check if the image source is lazy-loaded (e.g., check for attributes like `data-original`, `data-src`, `data-lazy`, `src`).

*Helper Javascript to run in Console:*
```javascript
// Test image extraction
(function() {
  const images = [];
  // Try finding major containers
  const imgElements = document.querySelectorAll('img');
  console.log("Total images found:", imgElements.length);
  // Log candidates with width, height, and attributes
  return Array.from(imgElements).slice(0, 50).map(img => ({
    src: img.src,
    dataSrc: img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src'),
    width: img.naturalWidth || img.clientWidth,
    height: img.naturalHeight || img.clientHeight,
    parentClass: img.parentElement.className
  }));
})();
```

### Step 3: Add/Update `config/sites.json`
Read the existing `config/sites.json` using `view_file` or a search query.
Add a new site profile entry with the following format:
```json
  "site_key": {
    "name": "Site Name",
    "domainPattern": "domain_regex_or_keyword",
    "chapterUrlPattern": "pattern_to_match_chapter_pages_only",
    "imageSelector": ".chapter-images-selector img",
    "imageUrlAttribute": "data-original|data-src|src",
    "titleSelector": ".manga-title-selector",
    "chapterSelector": ".chapter-title-selector",
    "referer": "https://www.target-domain.com/"
  }
```
*Note:* 
- `domainPattern` is a simple regex keyword (like `mangaball` or `comic\\.naver\\.com`) matching the site hostname.
- `chapterUrlPattern` is a regex/substring pattern (like `chapter-detail` or `detail|viewer`) used to distinguish chapter reading pages from browsing pages (like home/list pages). This prevents false "Page structure error" messages on homepages.

### Step 4: Verify Content Extraction
Verify that the selector fetches the images correctly on the test page.
Run `chrome_devtools_mcp_evaluate_script` on the page to test the newly configured selectors:
```javascript
(function() {
  const selector = '.chapter-images-selector img'; // Replace with discovered selector
  const attrCandidates = ['data-original', 'data-src', 'src']; // Replace with discovered attributes
  const imgs = document.querySelectorAll(selector);
  const urls = [];
  imgs.forEach(img => {
    for (const attr of attrCandidates) {
      const val = img.getAttribute(attr);
      if (val && (val.startsWith('http') || val.startsWith('//'))) {
        urls.push(val);
        break;
      }
    }
  });
  return {
    count: urls.length,
    sampleUrls: urls.slice(0, 3)
  };
})();
```

### Step 5: Test Downloading & Update Local Storage
After editing `config/sites.json`, write the changes. When running the extension manually or inside the agent testing setup:
1. Reload/re-sync the JSON configuration to `chrome.storage.local`.
2. Check if a download task can successfully run using the background download handler.
3. Validate that image files are successfully downloaded to the subdirectory structure.

### Step 6: Integrate Search Support for the New Site
When adding a new site, you should enable search integration in the **"Tìm Truyện"** popup search tab by updating the backend query logic:

1. **Analyze Search Mechanism**:
   - Trace the site's search requests in Chrome DevTools to find the search URL/endpoint.
   - Determine if it is a simple `GET` (e.g., Naver Webtoon `/api/search/all?keyword={query}`) or a secure `POST` (e.g., MangaBall `/api/v1/smart-search/search/` requiring cookies and CSRF headers).

2. **Implement in `background/background.js`**:
   - Locate the `searchManga(query)` function in [background.js](file:///c:/Users/Sea%20Flower/Pictures/manga%20downloader/background/background.js).
   - Add a search handler block inside a `try-catch` wrapper.
   - Query the search endpoint, parse the response, and format each result item as follows:
     ```javascript
     results.push({
       title: itemTitle,       // Cleaned title string
       author: itemAuthor,     // Author name or 'Nhiều tác giả'
       thumbnail: itemCover,   // Absolute URL to cover thumbnail
       url: itemUrl,           // Absolute URL to manga title details page
       source: siteName,       // Readable source name (e.g. 'MangaBall')
       sourceKey: siteKey      // Matching config key (e.g. 'mangaball')
     });
     ```

### Step 7: Log Progress and Session State for Agent Continuity
To ensure that subsequent sessions or different models can continue smoothly without losing progress:
1. **Always update a session log**: Create or append to a log file named `session_log.md` (or update `walkthrough.md` / `task.md` in the current brain workspace) after making changes or analyzing a site.
2. **Include critical metadata**:
   - The specific manga site analyzed.
   - Discovered DOM selectors (images, title, chapter).
   - Any customized code changes or format requirements (e.g. converting WebP to JPG, merging rules).
   - Status of verification and what needs to be implemented next.
3. Keep this file clean and structured so that any new model starting a turn can parse it immediately.

