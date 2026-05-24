## 2024-05-24 - Throttling expensive MutationObservers
**Learning:** Attaching a synchronous `MutationObserver` with `subtree: true` that executes `document.querySelectorAll` on every DOM mutation causes severe O(N*M) main-thread blocking during initial page loads on content-heavy pages (like manga reading sites with hundreds of images).
**Action:** Always throttle or debounce `MutationObserver` callbacks that trigger heavy DOM queries, especially when listening to the entire `document.documentElement`.
