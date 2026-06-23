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
  // Emulation must be set BEFORE navigate, but here we already navigated. Let me reopen with emulation.
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  // Open fresh tab with URL.
  const t = await send('Target.createTarget', { url: 'http://127.0.0.1:3000/' });
  const tid = t.targetId;
  const att = await send('Target.attachToTarget', { targetId: tid, flatten: true });
  const sid = att.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  // Wait for hydration.
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const r = await send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("#app-bottom-sheet").length + " | inner:" + window.innerWidth + "x" + window.innerHeight',
      returnByValue: true,
    }, sid);
    console.log('  poll', i, '->', r.result.value);
  }
  const dump = await send('Runtime.evaluate', {
    expression: 'JSON.stringify((() => { const els = Array.from(document.querySelectorAll("button, input, [role=status], h1, h2, h3, .leaflet-control")).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); return { vw: window.innerWidth, vh: window.innerHeight, count: els.length, items: els.map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, text: (el.innerText || el.value || el.placeholder || el.alt || el.getAttribute("aria-label") || "").slice(0,30), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }) }; })())',
    returnByValue: true,
  }, sid);
  console.log('raw:', (dump.result.value || '').slice(0, 400));
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
  // Also save a screenshot at this size.
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
  require('fs').writeFileSync(process.argv[3], Buffer.from(shot.data, 'base64'));
  console.log('saved', process.argv[3], require('fs').statSync(process.argv[3]).size);
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
