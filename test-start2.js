const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Use node directly instead of npm
  const output = execSync('node dist/main.js', { cwd: 'd:\\PrintFlow\\backend', encoding: 'utf-8', timeout: 5000 });
  fs.writeFileSync('d:\\PrintFlow\\start_output.txt', 'SUCCESS:\n' + output);
} catch (e) {
  // If it times out, it means it started successfully and stayed alive!
  if (e.code === 'ETIMEDOUT') {
    fs.writeFileSync('d:\\PrintFlow\\start_output.txt', 'SUCCESS_TIMEOUT:\n' + e.stdout);
  } else {
    fs.writeFileSync('d:\\PrintFlow\\start_output.txt', 'ERROR:\n' + e.stdout + '\n' + e.stderr);
  }
}
