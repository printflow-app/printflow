const { execSync } = require('child_process');
const fs = require('fs');
try {
  const output = execSync('npm run build', { cwd: 'd:\\PrintFlow\\backend', encoding: 'utf-8' });
  fs.writeFileSync('d:\\PrintFlow\\build_output.txt', 'SUCCESS:\n' + output);
} catch (e) {
  fs.writeFileSync('d:\\PrintFlow\\build_output.txt', 'ERROR:\n' + e.stdout + '\n' + e.stderr);
}
