## 2024-05-29 - [Fix Insecure escapeHtml implementation]
**Vulnerability:** XSS attribute injection vulnerability in `escapeHtml` function.
**Learning:** Using `document.createTextNode` combined with reading `.innerHTML` escapes `<`, `>`, and `&`, but fails to escape quotes (`"` and `'`). If the result is placed inside an HTML attribute, it enables XSS attacks.
**Prevention:** Always use regex-based replacements that explicitly cover all 5 unsafe characters (`&`, `<`, `>`, `"`, `'`) for robust HTML escaping. Do not rely on native DOM APIs for string escaping unless using contextual safe APIs like `.textContent`.
