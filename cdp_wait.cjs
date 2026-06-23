const WebSocket = require('ws');
const fs = require('fs');

const wsUrl = process.argv[2];
const out = process.argv[3];
const url = process.argv[4] || 'http://127.0.0.1:3000/';
const waitMs = parseInt(process.argv[5] || '3500', 10);

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

async function poll() {
  for (let i = 0; i < 6; i++) {
    const r = await send('Runtime.evaluate', {
      expression: 'document.body.innerText.length + " | sheets:" + document.querySelectorAll("[id=app-bottom-sheet]").length + " | chat:" + document.querySelectorAll(".custom-scrollbar").length',
      returnByValue: true,
    });
    console.log('poll', i, r.result.value);
    await new Promise(r => setTimeout(r, 1500));
  }
}

ws.on('open', async () => {
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: parseInt(process.argv[6] || '375', 10),
      height: parseInt(process.argv[7] || '812', 10),
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2500));
    await poll();
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
    console.log('saved', out, fs.statSync(out).size, 'bytes');
    process.exit(0);
  } catch (e) {
    console.error('CDP error:', e.message);
    process.exit(1);
  }
});
ws.on('message', (msg) => {
  const m = JSON.parse(msg.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
  }
});
ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1); });
