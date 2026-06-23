const fs = require('fs');
const zlib = require('node:zlib');
// Minimal PNG decode using zlib for IDAT (skip the pixel-perfect analysis, just look at unique colors per band).
const buf = fs.readFileSync(process.argv[2]);
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
console.log('Image:', w, 'x', h);
// Use child_process + sharp would be ideal, but not installed. Skip and look at file size + dimensions only.
console.log('size:', buf.length, 'bytes');
