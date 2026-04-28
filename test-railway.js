const https = require('https');

const req = https.request('https://printflow-production-bb78.up.railway.app/api/auth/super-admin/login', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://printflow-admin.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type, x-super-admin-key'
  }
}, (res) => {
  console.log('OPTIONS Status:', res.statusCode);
  console.log('OPTIONS Headers:', res.headers);
});
req.on('error', console.error);
req.end();

const req2 = https.request('https://printflow-production-bb78.up.railway.app/api/auth/super-admin/login', {
  method: 'POST',
  headers: {
    'Origin': 'https://printflow-admin.vercel.app',
    'Content-Type': 'application/json',
    'x-super-admin-key': 'test'
  }
}, (res) => {
  console.log('POST Status:', res.statusCode);
  console.log('POST Headers:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('POST Body:', data));
});
req2.on('error', console.error);
req2.write(JSON.stringify({ login: 'a', password: 'b' }));
req2.end();
