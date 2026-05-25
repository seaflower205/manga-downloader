## 2026-05-25 - Optimize DOM node image deduplication in content script
**Learning:** Found an O(N^2) loop in `getImages()` inside `content/content.js` where `Array.includes()` was used to deduplicate image URLs. This can block the main thread slightly on pages with hundreds of images, especially since `getImages()` is called repeatedly from a `MutationObserver` via `updateButtonState()`.
**Action:** Replaced `Array.includes()` with `Set.has()` for O(1) lookups, changing the complexity to O(N). This is a safe micro-optimization that prevents UI jank on image-heavy pages.
