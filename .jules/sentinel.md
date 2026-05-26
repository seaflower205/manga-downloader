## 2026-05-26 - [HIGH] Fix XSS risks in DOM rendering
**Vulnerability:** Use of innerHTML with dynamic data and incomplete escapeHtml string replacement which missed escaping double and single quotes.
**Learning:** Even when developers use an `escapeHtml` function, it may be flawed (e.g. relying on textNode injection and reading `div.innerHTML`, which misses escaping quotes). Direct assignment to `.innerHTML` should always be avoided.
**Prevention:** Strictly follow the application's policy to use `textContent` and `createElement` for all dynamic content. When escaping HTML is necessary, use a complete regex replacement that handles `&`, `<`, `>`, `"`, and `'`.
