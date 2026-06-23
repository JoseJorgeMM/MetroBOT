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
  await new Promise(r => setTimeout(r, 6000));
  // Find the drag handle (the w-full h-8 div near top of sheet).
  const handlePos = await send('Runtime.evaluate', {
    expression: '(() => { const el = document.querySelector("#app-bottom-sheet > div"); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height }; })()',
    returnByValue: true,
  });
  console.log('handle rect:', JSON.stringify(handlePos.result.value));
  // Click twice to go min -> mid -> max
  if (handlePos.result.value) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(handlePos.result.value.x), y: Math.round(handlePos.result.value.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 80));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(handlePos.result.value.x), y: Math.round(handlePos.result.value.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 600));
  }
  // After first click we should be at 'mid'. Click again to reach 'max'.
  if (handlePos.result.value) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(handlePos.result.value.x), y: Math.round(handlePos.result.value.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 80));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(handlePos.result.value.x), y: Math.round(handlePos.result.value.y), button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 600));
  }
  const res = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
  console.log('saved', out, fs.statSync(out).size);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
