// Offscreen Document Script for Manga Downloader
const activeLoads = new Map(); // Maps requestId to { resolve, reject, timeoutId, iframe }

// Listen for messages from the Background Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  if (message.type === 'PING') {
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'LOAD_URL') {
    const { url, requestId, timeout = 15000 } = message.data;

    // Create a dynamic iframe for this specific request
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const promise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanupIframe(requestId);
        reject(new Error(`Tải trang qua iframe ẩn bị quá thời gian (${timeout}ms)`));
      }, timeout);

      activeLoads.set(requestId, { resolve, reject, timeoutId, iframe });
    });

    const onLoad = () => {
      try {
        // Send a postMessage to the iframe's content script to request HTML, passing along the requestId
        iframe.contentWindow.postMessage({ type: 'MANGA_DL_GET_HTML', requestId }, '*');
      } catch (err) {
        console.error('Failed to post message to iframe window:', err);
      }
    };

    const onError = (err) => {
      const load = activeLoads.get(requestId);
      if (load) {
        cleanupIframe(requestId);
        load.reject(err || new Error('Lỗi load iframe'));
      }
    };

    iframe.addEventListener('load', onLoad);
    iframe.addEventListener('error', onError);

    iframe.src = url;

    promise.then(
      (html) => {
        sendResponse({ success: true, html });
      },
      (error) => {
        sendResponse({ success: false, error: error.message });
      }
    );

    return true; // Keep message channel open for async response
  }

  if (message.type === 'FETCH_IMAGE') {
    const { url, timeout = 15000 } = message.data;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(blob);
        });
      })
      .then((dataUrl) => {
        sendResponse({ success: true, dataUrl });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open for async response
  }
});

function cleanupIframe(requestId) {
  const load = activeLoads.get(requestId);
  if (load) {
    clearTimeout(load.timeoutId);
    if (load.iframe && load.iframe.parentNode) {
      try {
        load.iframe.parentNode.removeChild(load.iframe);
      } catch (e) {
        console.warn('Error removing iframe from document body:', e);
      }
    }
    activeLoads.delete(requestId);
  }
}

// Listen for DOM events posted back from the iframe's content script
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MANGA_DL_HTML_RESPONSE' && event.data.requestId) {
    const requestId = event.data.requestId;
    const load = activeLoads.get(requestId);
    if (load) {
      const html = event.data.html || '';
      load.resolve(html);
      cleanupIframe(requestId);
    }
  }
});
