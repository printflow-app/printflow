const http = require('http');

function fetch(path) {
  return new Promise((resolve) => {
    http.get({
      hostname: 'localhost',
      port: 3000,
      path: path,
      headers: {
        // Need to pass a valid token or bypass auth. But wait, API is protected by JWT?
        // Let's just try without token first to see if it's 401. If it's 500 even with 401 bypass, we'll see.
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', err => resolve({ status: 500, data: err.message }));
  });
}

async function run() {
  console.log('Fetching tasks...');
  const tasks = await fetch('/api/tasks');
  console.log('Tasks status:', tasks.status);
  console.log('Tasks body:', tasks.data.slice(0, 500));
  
  console.log('\nFetching customers...');
  const customers = await fetch('/api/customers');
  console.log('Customers status:', customers.status);
  console.log('Customers body:', customers.data.slice(0, 500));
}

run();
