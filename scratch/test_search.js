const https = require('https');

https.get('https://mangaball.net/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    // Find csrfToken definition
    const matches = data.match(/csrfToken\s*=\s*['"]([^'"]+)['"]/i) || data.match(/csrf-token['"]\s*content=['"]([^'"]+)['"]/i) || data.match(/['"]X-CSRF-TOKEN['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (matches) {
      console.log('CSRF Token Match:', matches[0]);
      console.log('Token value:', matches[1]);
    } else {
      // Print lines containing csrf
      const lines = data.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('csrf')) {
          console.log(`Line ${idx}: ${line.trim()}`);
        }
      });
    }
  });
}).on('error', (err) => {
  console.error(err);
});
