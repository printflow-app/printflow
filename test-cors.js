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
