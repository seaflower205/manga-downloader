## 2024-05-28 - Insecure HTML Escaping Pattern
**Vulnerability:** XSS Attribute Injection via `escapeHtml` (fails to escape quotes).
**Learning:** The codebase used a DOM-based `escapeHtml` function (`const div = document.createElement('div'); div.appendChild(document.createTextNode(str)); return div.innerHTML;`). While this escapes `<` and `>`, it typically leaves quotes (`"` and `'`) unescaped, allowing XSS when the escaped string is used in HTML attributes.
**Prevention:** Implement a full regex replacement for HTML escaping (`&`, `<`, `>`, `"`, `'`) instead of relying on `.innerHTML` reading.
