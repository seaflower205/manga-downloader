# Manga Downloader Premium

A Chrome extension for downloading manga chapters as ZIP files from multiple manga websites with automatic image detection and extraction.

## Features

- **Auto-Detection**: Automatically detects supported manga websites
- **Batch Download**: Download entire chapters as organized ZIP files
- **Multi-Site Support**: Works with MangaBall, Naver Webtoon, MangaPlaza, MangaDex, and more
- **Lazy-Load Support**: Handles lazy-loaded images (`data-src`, `data-original`, `data-lazy-src`)
- **GitHub Sync**: Auto-sync site configurations from GitHub repository
- **Dark/Light Mode**: Multiple theme options (Dark, Light, Grayscale)
- **Security**: Input validation, safe DOM rendering, no dynamic code execution
- **Diagnostics**: Built-in logging and error tracking (local only)

## Installation

1. **Download from GitHub**:
   - Clone: `git clone https://github.com/seaflower205/manga-downloader.git`
   - Or download ZIP and extract

2. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the extracted folder

3. **Verify Installation**:
   - You should see the Manga Downloader icon in your Chrome toolbar

## Usage

1. **Navigate to a Manga Chapter**:
   - Visit any supported manga reading page
   - The extension popup should appear automatically

2. **Download Chapter**:
   - Click the Manga Downloader extension icon
   - Review detected images
   - Click "Download as ZIP"
   - Save the file

3. **Configure Sites** (if needed):
   - Open the extension popup
   - Go to "Cấu Hình" (Configuration) tab
   - Add custom site selectors or modify existing ones

## Supported Sites

- **MangaBall** - mangaball.net
- **Naver Webtoon** - comic.naver.com
- **MangaPlaza** - mangaplaza.com
- **MangaDex** - mangadex.org
- **And more...** (See `config/sites.json` for full list)

## File Structure

```
├── manifest.json           # Extension configuration
├── background/
│   └── background.js       # Service worker (main logic)
├── content/
│   ├── content.js          # Content script (page interaction)
│   └── grabber.js          # Image extraction from MAIN world
├── popup/
│   ├── popup.html          # UI template
│   ├── popup.js            # UI logic
│   └── popup.css           # Styling
├── config/
│   └── sites.json          # Supported site profiles
├── icons/                  # Extension icons
└── utils/
    ├── security.js         # Security utilities & validation
    └── jszip.min.js        # ZIP creation library
```

## Site Configuration Schema

Each site in `config/sites.json` requires:

```json
{
  "siteName": {
    "name": "Display Name",
    "domainPattern": "regex or keyword matching domain",
    "chapterUrlPattern": "regex pattern for chapter pages",
    "imageSelector": "CSS selector for images",
    "imageUrlAttribute": "src|data-src|data-original",
    "titleSelector": "CSS selector for manga title",
    "chapterSelector": "CSS selector for chapter info",
    "referer": "https://website.com/"
  }
}
```

## Security

- **No Dynamic Execution**: No `eval()`, no `new Function()`
- **Input Validation**: All URLs and selectors validated before use
- **Safe DOM Rendering**: Uses `textContent` and `createElement` instead of `innerHTML`
- **Local Storage Only**: Diagnostics stored locally, never sent to external servers
- **Privacy**: DOM captures are sanitized (scripts/styles/inputs removed)

## Permissions

- `storage` - Save site configs and settings
- `downloads` - Download ZIP files
- `declarativeNetRequest` - Handle network requests safely
- `<all_urls>` - Access all websites for image extraction

## Browser Compatibility

- **Chrome/Chromium** 90+
- **Edge** 90+
- **Brave** 1.0+
- **Opera** 76+

## Development

No build process required. This is a standard Manifest V3 extension.

### Testing
1. Load unpacked into Chrome (see Installation)
2. Open DevTools (F12) on a manga page
3. Check Console for extension logs
4. Use "Chẩn Đoán" tab in popup for diagnostics

### Adding New Sites
1. Open a manga chapter page
2. Use DevTools to find CSS selectors
3. Add profile to `config/sites.json`
4. Reload extension (`chrome://extensions/`)
5. Test download

## Troubleshooting

**Images not detected?**
- Check "Chẩn Đoán" tab in popup
- Verify CSS selectors in site config
- Some sites may require custom selectors

**Download fails?**
- Check browser permissions
- Verify image URLs are accessible
- Check disk space

**Site not recognized?**
- Site may not be in config yet
- Use Configuration tab to add custom site

## License

Open source. Free to use and modify.

## Support

Issues or suggestions? Create them on the GitHub repository.

---

**GitHub**: https://github.com/seaflower205/manga-downloader
