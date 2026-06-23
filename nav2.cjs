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
  // Open new tab with URL directly.
  const t = await send('Target.createTarget', { url: 'http://127.0.0.1:3000/' });
  const tid = t.targetId;
  console.log('opened', tid);
  const att = await send('Target.attachToTarget', { targetId: tid, flatten: true });
  const sid = att.sessionId;
  console.log('attached', sid);
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await new Promise(r => setTimeout(r, 14000));
  const dump = await send('Runtime.evaluate', {
    expression: 'JSON.stringify((() => { const els = Array.from(document.querySelectorAll("button, input, [role=status], h1, h2, h3, .leaflet-control")).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); return { vw: window.innerWidth, vh: window.innerHeight, count: els.length, items: els.map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, text: (el.innerText || el.value || el.placeholder || el.alt || el.getAttribute("aria-label") || "").slice(0,30), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }) }; })())',
    returnByValue: true,
  }, sid);
  console.log('raw:', (dump.result.value || '').slice(0, 300));
  let parsed = null;
  try { parsed = JSON.parse(dump.result.value); } catch (e) {}
  if (parsed) {
    console.log('viewport:', parsed.vw, 'x', parsed.vh);
    console.log('elements:', parsed.count);
    for (const e of parsed.items) console.log(' [' + e.tag + '] x=' + e.x + ' y=' + e.y + ' w=' + e.w + ' h=' + e.h + ' | ' + e.text);
    const tooSmall = parsed.items.filter(e => (e.tag === 'BUTTON' || e.tag === 'INPUT') && Math.min(e.w, e.h) < 32);
    console.log('--- Buttons/inputs smaller than 32px: ' + tooSmall.length);
    for (const e of tooSmall) console.log(' ', e.tag, e.w + 'x' + e.h, '|', e.text);
  }
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
