const https = require('https');

const options = {
  hostname: 'comic.naver.com',
  port: 443,
  path: '/api/search/all?keyword=' + encodeURIComponent('god'),
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://comic.naver.com/search?keyword=god'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('JSON Keys:', Object.keys(json));
      for (const [key, value] of Object.entries(json)) {
        console.log(`- ${key}: totalCount = ${value.totalCount}, listLength = ${value.searchViewList ? value.searchViewList.length : 'N/A'}`);
        if (value.searchViewList && value.searchViewList.length > 0) {
          console.log(`  First item of ${key}:`, JSON.stringify(value.searchViewList[0], null, 2));
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  });
});
