const https = require('https');

function getMangaBallTokenAndCookie() {
  return new Promise((resolve, reject) => {
    https.get('https://mangaball.net/', (res) => {
      let data = '';
      const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const match = data.match(/csrf-token["']\s*content=["']([^"']+)["']/i);
        if (match) {
          resolve({ token: match[1], cookie });
        } else {
          reject(new Error('Could not find CSRF token in HTML'));
        }
      });
    }).on('error', reject);
  });
}

function searchMangaBall(query, token, cookie) {
  return new Promise((resolve, reject) => {
    const postData = 'search_input=' + encodeURIComponent(query);
    const options = {
      hostname: 'mangaball.net',
      port: 443,
      path: '/api/v1/smart-search/search/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-CSRF-TOKEN': token,
        'Cookie': cookie
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  try {
    console.log('Fetching homepage...');
    const { token, cookie } = await getMangaBallTokenAndCookie();
    console.log('Got CSRF Token:', token);
    console.log('Got Cookie:', cookie);
    
    console.log('Performing search...');
    const result = await searchMangaBall('Wistoria', token, cookie);
    console.log('Status Code:', result.statusCode);
    console.log('Data:', JSON.stringify(JSON.parse(result.data), null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
