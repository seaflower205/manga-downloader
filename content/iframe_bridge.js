// Lightweight content script to securely bridge iframe DOM contents to the extension's offscreen document
(function () {
  // Only run in child frames (iframes)
  if (window === window.top) return;

  window.addEventListener('message', (event) => {
    // Security: Only allow communication initiated by our own extension ID
    const extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
    if (event.origin !== extensionOrigin) return;

    if (event.data && event.data.type === 'MANGA_DL_GET_HTML') {
      try {
        event.source.postMessage({
          type: 'MANGA_DL_HTML_RESPONSE',
          requestId: event.data.requestId,
          html: document.documentElement.outerHTML,
          url: window.location.href
        }, event.origin);
      } catch (e) {
        console.error('Manga Downloader: Failed to send HTML from iframe:', e);
      }
    }
  });
})();
