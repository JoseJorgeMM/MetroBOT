const WebSocket = require('ws');
const fs = require('fs');
const wsUrl = process.argv[2];
const out = process.argv[3];
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
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
  await new Promise(r => setTimeout(r, 14000));
  // Snapshots of sheet visibility over time:
  for (let i = 0; i < 6; i++) {
    const r = await send('Runtime.evaluate', { expression: '(() => { const s = document.querySelector("#app-bottom-sheet"); if (!s) return null; const r = s.getBoundingClientRect(); const h = s.firstElementChild; const hr = h ? h.getBoundingClientRect() : null; return { sheetTop: r.top, sheetHeight: r.height, viewport: window.innerHeight, handleTop: hr ? hr.top : null, handleHeight: hr ? hr.height : null }; })()', returnByValue: true });
    console.log('snapshot', i, JSON.stringify(r.result.value));
    await new Promise(r => setTimeout(r, 1500));
  }
  // Click handle (first child of sheet, top center, h-8 = 32px CSS).
  const clickRes = await send('Runtime.evaluate', {
    expression: '(() => { const h = document.querySelector("#app-bottom-sheet > div"); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + 4 }; })()',
    returnByValue: true,
  });
  const pos = clickRes.result.value;
  console.log('click at:', JSON.stringify(pos));
  if (pos) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(pos.x), y: Math.round(pos.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 80));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(pos.x), y: Math.round(pos.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 700));
    // Click again to reach max
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(pos.x), y: Math.round(pos.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 80));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(pos.x), y: Math.round(pos.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 700));
  }
  const r = await send('Runtime.evaluate', { expression: '(() => { const s = document.querySelector("#app-bottom-sheet"); if (!s) return null; const r = s.getBoundingClientRect(); return { sheetTop: r.top, sheetHeight: r.height, classes: s.className }; })()', returnByValue: true });
  console.log('after click:', JSON.stringify(r.result.value));
  const res = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
  console.log('saved', out, fs.statSync(out).size);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
