const fs = require('fs');
let s = fs.readFileSync('src/lib/gemini.ts', 'utf8');
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf("DATOS DE RED SITVA") === 0 && lines[i].indexOf("grounding") !== -1) {
    lines[i] = "DATOS DE RED SITVA:\\n' + grounding;";
  }
}
fs.writeFileSync('src/lib/gemini.ts', lines.join('\n'), 'utf8');
console.log('fixed');
