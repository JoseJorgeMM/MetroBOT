const fs = require('fs');
let s = fs.readFileSync('src/lib/gemini.ts', 'utf8');
// The literal backslash-n is treated as escape n. Fix: replace with double backslash.
const before = "DATOS DE RED SITVA:\n' + grounding;";
const after = "DATOS DE RED SITVA:\\n' + grounding;";
if (s.indexOf(before) !== -1) {
  s = s.replace(before, after);
  fs.writeFileSync('src/lib/gemini.ts', s, 'utf8');
  console.log('fixed');
} else {
  console.log('not found');
}
