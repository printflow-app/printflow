const { spawn } = require('child_process');
const fs = require('fs');

const proc = spawn('npm', ['run', 'start:prod'], { cwd: 'd:\\PrintFlow\\backend' });
let output = '';

proc.stdout.on('data', data => output += data.toString());
proc.stderr.on('data', data => output += data.toString());

setTimeout(() => {
  proc.kill();
  fs.writeFileSync('d:\\PrintFlow\\start_output.txt', output);
  process.exit(0);
}, 5000);
