const fs = require('fs');
const PNG = require('pngjs').PNG;
const buf = fs.readFileSync('mobile_screenshots/mobile-state.png');
const png = PNG.sync.read(buf);
const w = png.width, h = png.height;
function pixel(x, y) { const idx = (y * w + x) * 4; return [png.data[idx], png.data[idx+1], png.data[idx+2]]; }
// Look for the white/cream bottom-sheet and the icons in it.
// Bottom sheet region is roughly y=940..1624 (CSS 470..812).
// Compute, for each row in that range, the dominant color.
function bucket(r,g,b) {
  if (r > 230 && g > 230 && b > 230) return 'white';
  if (r < 40 && g < 40 && b < 40) return 'black';
  if (r > 230 && g > 200 && b < 130) return 'amber';
  if (r < 50 && g > 130 && b < 80) return 'sitva-green';
  if (r > 80 && g > 80 && b > 90 && b < 110) return 'slate';
  return 'other';
}
console.log('Sampling every 50px in the bottom half of the image:');
for (let y = 800; y < h; y += 50) {
  const buckets = new Map();
  for (let x = 0; x < w; x += 6) {
    const [r,g,b] = pixel(x, y);
    const k = bucket(r,g,b);
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const top = [...buckets.entries()].sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => k+':'+v).join(' ');
  console.log('  y=' + y + ' (' + Math.round(y/2) + 'px CSS) top=' + top);
}
