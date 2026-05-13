const fs = require('fs');

async function checkModels() {
  try {
    const envFile = fs.readFileSync('.env', 'utf8');
    const keyLine = envFile.split('\n').find(line => line.startsWith('GOOGLE_GENERATIVE_AI_API_KEY='));
    if (keyLine) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = keyLine.split('=')[1].trim().replace(/['"]/g, '');
    }
  } catch (e) {}

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.models) {
      const names = data.models.map(m => m.name).filter(n => n.includes('gemini'));
      console.log('MAVJUD GEMINI MODELLAR:');
      console.log(names.join('\n'));
    } else {
      console.log('Error:', data);
    }
  } catch (err) {
    console.error('Error fetching models:', err);
  }
}

checkModels();
