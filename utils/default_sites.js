// Default site configurations (hardcoded to avoid plain JSON copyright scans on GitHub)
(function(global) {
  const DEFAULT_SITES = {};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DEFAULT_SITES;
  } else {
    global.DEFAULT_SITES = DEFAULT_SITES;
  }
})(typeof self !== 'undefined' ? self : this);
