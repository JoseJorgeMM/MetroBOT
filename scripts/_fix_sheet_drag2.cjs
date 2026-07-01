const fs = require('fs');
let s = fs.readFileSync('tests/test_sheet_drag.mjs', 'utf8');
s = s.replace("eq('fast flick UP v=-0.8 from min -> max', nextSnap(0, SNAPS, 0, -0.8), 2);", "eq('fast flick UP v=-0.8 from min -> mid (one step)', nextSnap(0, SNAPS, 0, -0.8), 1);");
fs.writeFileSync('tests/test_sheet_drag.mjs', s, 'utf8');
console.log('ok');
