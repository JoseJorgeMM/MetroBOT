const WebSocket = require('ws');
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
}
(async () => {
  ws.on('message', (msg) => { const m = JSON.parse(msg.toString()); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); } });
  await new Promise(r => ws.on('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  // Extract every interactive element with its bounding box and computed style.
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const out = [];
      const els = document.querySelectorAll('button, input, [role="status"], #app-bottom-sheet, [class*="max-w-"], h1, h2, h3');
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.push({
          tag: el.tagName,
          text: (el.innerText || el.value || el.placeholder || el.alt || el.getAttribute('aria-label') || '').slice(0, 40),
          x: Math.round(r.left), y: Math.round(r.top),
          w: Math.round(r.width), h: Math.round(r.height),
          fs: cs.fontSize, br: cs.borderRadius, bg: cs.backgroundColor.slice(0, 25)
        });
      }
      return out;
    })()`,
    returnByValue: true,
  });
  const rows = r.result.value || [];
  console.log('Viewport: 375x812 CSS (deviceScaleFactor 2 -> 750x1624 px).');
  console.log('Interactive elements (' + rows.length + '):');
  for (const e of rows) {
    if (e.w === 0 && e.h === 0) continue;
    console.log(' [' + e.tag + '] x=' + e.x + ' y=' + e.y + ' w=' + e.w + ' h=' + e.h + ' fs=' + e.fs + ' | ' + (e.text || ''));
  }
})().catch(e => { console.error(e); process.exit(1); });
