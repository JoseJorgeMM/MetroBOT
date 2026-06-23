const fs = require('fs');
const PNG = require('pngjs').PNG;
const buf = fs.readFileSync(process.argv[2]);
const png = PNG.sync.read(buf);
const w = png.width, h = png.height;
console.log('Image:', w, 'x', h);
// Scan the bottom 30% of the image (the sheet region) and bucket colors.
function pixel(x, y) {
  const idx = (y * w + x) * 4;
  return [png.data[idx], png.data[idx+1], png.data[idx+2]];
}
// Sample at 5 horizontal slices
const sliceCount = 8;
for (let s = 0; s < sliceCount; s++) {
  const y = Math.floor(h * (s + 0.5) / sliceCount);
  const xs = [50, w/4, w/2, 3*w/4, w-50].map(x => pixel(Math.floor(x), y));
  console.log('y=' + y + ': ' + xs.map(c => `rgb(${c[0]},${c[1]},${c[2]})`).join(' | '));
}
// Detect dominant hue in bottom 35% (the sheet region)
let whiteCount = 0, amberCount = 0, greenCount = 0, blueCount = 0, darkCount = 0, otherCount = 0;
for (let y = Math.floor(h * 0.65); y < h; y += 4) {
  for (let x = 0; x < w; x += 4) {
    const [r,g,b] = pixel(x, y);
    if (r > 240 && g > 240 && b > 240) whiteCount++;
    else if (r > 240 && g > 200 && b < 100) amberCount++;
    else if (r < 100 && g > 130 && b < 130) greenCount++;
    else if (r < 60 && g < 100 && b > 180) blueCount++;
    else if (r < 50 && g < 50 && b < 50) darkCount++;
    else otherCount++;
  }
}
console.log('\nBottom 35% pixel buckets:');
console.log('  white:', whiteCount, ' amber:', amberCount, ' green:', greenCount, ' blue:', blueCount, ' dark:', darkCount, ' other:', otherCount);
