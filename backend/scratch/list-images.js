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
      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
        results.push({
          path: fullPath,
          size: stat.size,
          mtime: stat.mtime
        });
      }
    }
  });
  return results;
}

const found = walk('d:\\PrintFlow');
console.log(`Found ${found.length} image files:`);
found.forEach(f => console.log(`- Path: ${f.path}\n  Size: ${f.size} bytes\n  Modified: ${f.mtime.toISOString()}`));
