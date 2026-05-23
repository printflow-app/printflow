const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.claude') return;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      if (file.toLowerCase().includes('mix') || file.toLowerCase().includes('miks')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const foundFiles = walk('d:\\PrintFlow');
console.log(`Found ${foundFiles.length} files matching:`);
foundFiles.forEach(f => console.log(`- ${f}`));
