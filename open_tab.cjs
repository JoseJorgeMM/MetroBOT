const WebSocket = require('ws');
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg)); });
}
(async () => {
  ws.on('message', (msg) => { const m = JSON.parse(msg.toString()); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); } });
  await new Promise(r => ws.on('open', r));
  const t = await send('Target.createTarget', { url: 'http://127.0.0.1:3000/' });
  const tid = t.targetId;
  const att = await send('Target.attachToTarget', { targetId: tid, flatten: true });
  const sid = att.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }, sid);
  await new Promise(r => setTimeout(r, 10000));
  const r = await send('Runtime.evaluate', {
    expression: 'JSON.stringify((() => { const buttons = Array.from(document.querySelectorAll("button, input, [role=status]")).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { tag: el.tagName, text: (el.innerText || el.value || el.placeholder || el.alt || "").slice(0,30), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, br: cs.borderRadius, padding: cs.padding }; }))',
    returnByValue: true,
  }, sid);
  const rows = JSON.parse(r.result.value);
  console.log('viewport inner:', JSON.stringify(rows.map(x=>x.tag).length));
  for (const e of rows) {
    console.log(' [' + e.tag + '] x=' + e.x + ' y=' + e.y + ' w=' + e.w + ' h=' + e.h + ' fs=' + e.fs + ' pad=' + e.padding + ' | ' + e.text);
  }
  console.log('total:', rows.length);
  const tooSmall = rows.filter(e => (e.tag === 'BUTTON' || e.tag === 'INPUT') && Math.min(e.w, e.h) < 32);
  console.log('Buttons/inputs smaller than 32px:', tooSmall.length);
  for (const e of tooSmall) console.log(' ', e.tag, e.w + 'x' + e.h, '|', e.text);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
