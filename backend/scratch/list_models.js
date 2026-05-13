const https = require('https');

const apiKey = 'AIzaSyAC_MVOUdvY9hR-mWnbfJI3-UhZOMH1VQ8';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('--- AVAILABLE MODELS ---');
    try {
      const json = JSON.parse(data);
      if (json.models) {
        json.models.forEach(m => console.log(m.name));
      } else {
        console.log('No models found or error:', data);
      }
    } catch (e) {
      console.log('Parse error:', data);
    }
    console.log('------------------------');
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
