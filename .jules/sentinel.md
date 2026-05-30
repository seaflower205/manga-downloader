## 2024-05-15 - Incomplete HTML Escaping
**Vulnerability:** The `escapeHtml` function implemented as `div.appendChild(document.createTextNode(str)); return div.innerHTML;` fails to escape quotes (`"` and `'`), leading to XSS vulnerabilities when the output is placed inside HTML attributes (e.g. `<div class="manga-dl-title">${escapeHtml(title)}</div>` in `content/ui.js`).
**Learning:** Using `createTextNode` and `.innerHTML` does not consistently escape quotes across all browsers/scenarios for attribute insertion, only for text node content.
**Prevention:** Always use complete regex replacement covering `&`, `<`, `>`, `"`, and `'` for custom HTML escaping.
