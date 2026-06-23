const fs = require('fs');
const PNG = require('pngjs').PNG;
const buf = fs.readFileSync(process.argv[2]);
const png = PNG.sync.read(buf);
const w = png.width, h = png.height;
function pixel(x, y) {
  const idx = (y * w + x) * 4;
  return [png.data[idx], png.data[idx+1], png.data[idx+2]];
}
// Find horizontal bands where the right half has a different dominant color than the left (the map).
function rowProfile(y) {
  const buckets = new Map();
  for (let x = 0; x < w; x += 8) {
    const [r,g,b] = pixel(x, y);
    const key = (r > 220 && g > 220 && b > 220) ? 'white'
      : (r < 30 && g < 30 && b < 30) ? 'black'
      : (r > 220 && g > 150 && b < 80) ? 'amber'
      : (r < 80 && g > 130 && b < 100) ? 'green'
      : (r < 60 && g < 100 && b > 180) ? 'blue'
      : (r > 50 && r < 80 && g > 55 && g < 75 && b > 80 && b < 100) ? 'slate'
      : 'other';
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return [...buckets.entries()].sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => k+':'+v).join(' ');
}
console.log('Row profiles (every 8% of image height):');
for (let s = 0; s < 25; s++) {
  const y = Math.floor(h * s / 25);
  console.log('  ' + Math.round(y/h*100) + '% y=' + y + ' px ' + rowProfile(y));
}
