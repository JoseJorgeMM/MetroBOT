const fs = require('fs');
let s = fs.readFileSync('index.html', 'utf8');
s = s.replace('maximum-scale=5.0', 'maximum-scale=1.0');
if (!s.includes('format-detection')) {
  s = s.replace('</head>', '    <meta name="format-detection" content="telephone=no">\n  </head>');
}
fs.writeFileSync('index.html', s, 'utf8');
console.log('patched');
