const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async () => {
  const src = path.join('public', 'logo_chat.png');
  if (!fs.existsSync(src)) { console.error('logo_chat.png missing'); process.exit(1); }
  const out = (n) => path.join('public', n);
  await sharp(src).resize(192, 192, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(out('icon-192.png'));
  await sharp(src).resize(512, 512, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(out('icon-512.png'));
  const pad = Math.floor(512 * 0.10);
  const inner = 512 - pad * 2;
  await sharp(src).resize(inner, inner, { fit: 'cover' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 153, b: 76, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(out('icon-maskable-512.png'));
  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    console.log('wrote', f, fs.statSync(out(f)).size, 'bytes');
  }
})().catch(e => { console.error(e); process.exit(1); });
