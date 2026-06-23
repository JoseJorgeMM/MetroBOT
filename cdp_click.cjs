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
  // Click the drag handle (top center of sheet at MIN state, ~ h-8 = 32px CSS = 64px px in 2x DPR).
  // The handle is at the top of the sheet, centered horizontally, ~bottom-(h-20) = ~ y=1474 in 1624-tall image.
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 375, y: 1474, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 100));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 375, y: 1474, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 800));
  // Click again to reach max for visual.
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 375, y: 600, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 100));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 375, y: 600, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 800));
  const res = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
  console.log('saved', out, fs.statSync(out).size);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
