const fs = require('fs');
const path = require('path');

const pagesDir = path.join('D:', 'dev', 'nekomorto', 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.startsWith('Dashboard') && f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  // Replace 'animate-slide-up opacity-0' with 'animate-slide-up'
  content = content.replace(/animate-slide-up opacity-0/g, 'animate-slide-up');
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
});
