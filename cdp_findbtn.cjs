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
  // Directly query button and input positions + tap target sizes.
  const r = await send('Runtime.evaluate', {
    expression: 'JSON.stringify((() => { const buttons = Array.from(document.querySelectorAll("button, input, [role=status]")).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { tag: el.tagName, text: (el.innerText || el.value || el.placeholder || el.alt || "").slice(0,30), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, br: cs.borderRadius, padding: cs.padding }; }))',
    returnByValue: true,
  });
  const rows = JSON.parse(r.result.value);
  console.log('viewport:', JSON.stringify(rows.map(x=>x.viewport || 'n/a')));
  for (const e of rows) {
    console.log(' [' + e.tag + '] x=' + e.x + ' y=' + e.y + ' w=' + e.w + ' h=' + e.h + ' fs=' + e.fs + ' pad=' + e.padding + ' | ' + e.text);
  }
  console.log('total:', rows.length);
  // Detect potential tap-target issues: any button or input with min(w,h) < 32?
  const tooSmall = rows.filter(e => (e.tag === 'BUTTON' || e.tag === 'INPUT') && Math.min(e.w, e.h) < 32);
  console.log('Buttons/inputs smaller than 32px (mobile tap-target violation):', tooSmall.length);
  for (const e of tooSmall) console.log(' ', e.tag, e.w + 'x' + e.h, '|', e.text);
})().catch(e => { console.error(e); process.exit(1); });
