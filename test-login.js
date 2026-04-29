const https = require('https');

const data = JSON.stringify({
  login: 'superadmin',
  password: 'Admin2026!'
});

const options = {
  hostname: 'printflow-production-bb78.up.railway.app',
  port: 443,
  path: '/api/auth/super-admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);

  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
