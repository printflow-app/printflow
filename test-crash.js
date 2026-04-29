const { spawn } = require('child_process');
const fs = require('fs');

const proc = spawn('node', ['dist/main.js'], { cwd: 'd:\\PrintFlow\\backend' });
let output = '';

proc.stdout.on('data', data => output += data.toString());
proc.stderr.on('data', data => output += data.toString());

proc.on('close', code => {
  fs.writeFileSync('d:\\PrintFlow\\crash_log.txt', `EXIT CODE: ${code}\n\n${output}`);
});

setTimeout(() => {
  proc.kill();
  fs.writeFileSync('d:\\PrintFlow\\crash_log.txt', `TIMEOUT (APP RUNNING FINE)\n\n${output}`);
}, 5000);
