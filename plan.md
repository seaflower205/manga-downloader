1. **Fix Insecure `escapeHtml` in `content/content.js`**
   - The current implementation of `escapeHtml` relies on `div.appendChild` and `div.innerHTML`. This fails to escape quotes (`"` and `'`), making it vulnerable to XSS attribute injection if the sanitized string is placed within an HTML attribute.
   - Replace it with a robust regex-based escaping function covering `&`, `<`, `>`, `"`, and `'`.

2. **Fix Insecure `escapeHtml` in `content/ui.js`**
   - Apply the same regex-based escaping function to `content/ui.js` where `escapeHtml` is duplicated.

3. **Pre-commit Steps**
   - Complete pre-commit steps to ensure proper testing, verifications, reviews, and reflections are done.

4. **Submit the PR**
   - PR title: `🛡️ Sentinel: [HIGH] Fix XSS attribute injection in HTML escaping`
   - PR description will include Severity, Vulnerability, Impact, Fix, and Verification.
