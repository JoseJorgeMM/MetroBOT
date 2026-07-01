const fs = require('fs');
let s = fs.readFileSync('tests/_routeValidator_impl.mjs', 'utf8');
const bad = 'const METRO_MODES = new Set([" metro,metrocable,	ranvia,metroplus,encicla]);';
const good = 'const METRO_MODES = new Set(["metro","metrocable","tranvia","metroplus","encicla"]);';
if (s.indexOf(bad) !== -1) {
  s = s.replace(bad, good);
  fs.writeFileSync('tests/_routeValidator_impl.mjs', s);
  console.log('fixed');
} else {
  console.log('not found, current line:');
  const lines = s.split('\n');
  for (let i = 110; i < Math.min(116, lines.length); i++) {
    console.log(i + 1, JSON.stringify(lines[i]));
  }
}
