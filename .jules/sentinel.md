## 2026-05-24 - InnerHTML Template Interpolation
**Vulnerability:** Use of `innerHTML` with template literals containing dynamically generated variables.
**Learning:** Even if some variables were escaped, interpolating dynamically generated strings into `innerHTML` is a bad practice and poses an XSS risk. The project's security guidelines strictly forbid it.
**Prevention:** Use static HTML skeletons for `innerHTML` and dynamically update them using `textContent` and `createElement` DOM methods.
