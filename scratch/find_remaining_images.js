const fs = require('fs');
const path = require('path');

const channelsDir = path.join(__dirname, '..', 'public', 'assets', 'img', 'channels');
const cats = fs.readdirSync(channelsDir);

cats.forEach(c => {
  const cPath = path.join(channelsDir, c);
  if (fs.statSync(cPath).isDirectory()) {
    function walk(dir) {
      let files = [];
      fs.readdirSync(dir).forEach(item => {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          files = files.concat(walk(full));
        } else if (/\.(png|jpe?g|webp|gif|svg)$/i.test(item)) {
          files.push(path.relative(cPath, full).replace(/\\/g, '/'));
        }
      });
      return files;
    }
    const found = walk(cPath);
    console.log(`Channel [${c}]: ${found.length} images found. First few:`, found.slice(0, 5));
  }
});
