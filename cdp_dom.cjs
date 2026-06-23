const WebSocket = require('ws');
const fs = require('fs');
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
(async () => {
  ws.on('message', (msg) => {
    const m = JSON.parse(msg.toString());
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); }
  });
  await new Promise(r => ws.on('open', r));
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
  await new Promise(r => setTimeout(r, 6000));
  const html = await send('Runtime.evaluate', { expression: 'document.body.innerHTML', returnByValue: true });
  fs.writeFileSync('mobile_screenshots/dom.html', html.result.value);
  console.log('dom saved, length:', html.result.value.length);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
