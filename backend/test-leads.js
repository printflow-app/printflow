const http = require('http');

const data = JSON.stringify({
  firstName: 'Test',
  lastName: 'Test',
  companyName: 'Test',
  role: 'Test',
  phone: 'Test'
});

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
