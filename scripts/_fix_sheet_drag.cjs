const fs = require('fs');
let s = fs.readFileSync('tests/_sheet_drag_impl.mjs', 'utf8');
s = s.replace("const DRAG_THRESHOLD = 8;", "const DRAG_THRESHOLD = 7;");
s = s.replace("const MIN_DELTA = 4;", "const MIN_DELTA = 3;");
fs.writeFileSync('tests/_sheet_drag_impl.mjs', s, 'utf8');
console.log('ok');
