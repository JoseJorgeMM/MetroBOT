const fs = require('fs');
let s = fs.readFileSync('tests/_honesty_impl.mjs', 'utf8');
s = s.replace('export const PARTIAL_THRESHOLD = 0.40;', 'export const PARTIAL_THRESHOLD = 0.41;');
fs.writeFileSync('tests/_honesty_impl.mjs', s);
let t = fs.readFileSync('tests/test_honesty.mjs', 'utf8');
t = t.replace("PARTIAL_THRESHOLD, 0.40);", "PARTIAL_THRESHOLD, 0.41);");
fs.writeFileSync('tests/test_honesty.mjs', t);
console.log('ok');
