// Grabber script running in the MAIN world to access page global variables
(function () {
  const sendData = () => {
    if (typeof chapterImages !== 'undefined' && Array.isArray(chapterImages)) {
      document.dispatchEvent(new CustomEvent('MangaDownloaderData', {
        detail: {
          chapterImages: chapterImages
        }
      }));
    }
  };

  // Run immediately
  sendData();

  // Run on window load
  window.addEventListener('load', sendData);

  // Poll for a few seconds to handle late initialization
  let checks = 0;
  const interval = setInterval(() => {
    sendData();
    if (checks++ > 20) {
      clearInterval(interval);
    }
  }, 250);
})();
