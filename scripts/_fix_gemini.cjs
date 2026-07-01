const fs = require('fs');
let s = fs.readFileSync('src/lib/gemini.ts', 'utf8');
// The current line 250 has literal backslash-n due to the patch. Fix it.
const before = String.raw`DATOS DE RED SITVA:\n' + grounding;`;
const after = "DATOS DE RED SITVA:\\n' + grounding;";
if (s.indexOf(before) !== -1) {
  s = s.replace(before, after);
  fs.writeFileSync('src/lib/gemini.ts', s);
  console.log('fixed prompt literal');
} else {
  console.log('prompt literal not found');
}
