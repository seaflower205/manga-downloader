// Grabber script running in the MAIN world to access page global variables
// Uses a hidden DOM element as a bridge to pass data to the ISOLATED world content script
(function () {
  const BRIDGE_ID = '__manga_dl_bridge__';

  const sendData = () => {
    if (typeof chapterImages !== 'undefined' && Array.isArray(chapterImages) && chapterImages.length > 0) {
      // Create or update a hidden DOM element with the data
      let bridge = document.getElementById(BRIDGE_ID);
      if (!bridge) {
        bridge = document.createElement('script');
        bridge.id = BRIDGE_ID;
        bridge.type = 'application/json';
        bridge.style.display = 'none';
        (document.head || document.documentElement).appendChild(bridge);
      }
      bridge.textContent = JSON.stringify(chapterImages);
    }
  };

  // Try immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendData);
  } else {
    sendData();
  }

  // Also on full load
  window.addEventListener('load', sendData);

  // Poll for late initialization (some sites set chapterImages after AJAX)
  let checks = 0;
  const interval = setInterval(() => {
    sendData();
    if (++checks > 30) {
      clearInterval(interval);
    }
  }, 300);
})();
