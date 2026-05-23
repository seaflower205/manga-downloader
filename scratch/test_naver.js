const https = require('https');

const options = {
  hostname: 'comic.naver.com',
  port: 443,
  path: '/search?keyword=' + encodeURIComponent('tower'),
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('HTML length:', data.length);
    console.log('HTML:', data);
  });
}).on('error', (err) => {
  console.error(err);
});
