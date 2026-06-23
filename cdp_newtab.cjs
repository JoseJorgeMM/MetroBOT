const WebSocket = require('ws');
const fs = require('fs');
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
const events = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
(async () => {
  try {
    ws.on('message', (msg) => {
      const m = JSON.parse(msg.toString());
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        events.push({ level: m.params.type, text: m.params.args.map(a => a.value).join(' ') });
      }
    });
    await new Promise(r => ws.on('open', r));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    const t = await send('Target.createTarget', { url: 'http://127.0.0.1:3000/' });
    const newTarget = t.result.targetId;
    console.log('opened new tab:', newTarget);
    const att = await send('Target.attachToTarget', { targetId: newTarget, flatten: true });
    const sessionId = att.result.sessionId;
    await new Promise(r => setTimeout(r, 6000));
    const sheets = await send('Runtime.evaluate', { expression: 'document.querySelectorAll("#app-bottom-sheet").length', returnByValue: true, sessionId });
    console.log('sheets:', sheets.result.value);
    const map = await send('Runtime.evaluate', { expression: 'document.querySelectorAll(".leaflet-container").length', returnByValue: true, sessionId });
    console.log('leaflet:', map.result.value);
    console.log('console events:', events.length);
    for (const e of events.slice(0, 25)) console.log(' ', e.level, '::', e.text.slice(0, 250));
    const res = await send('Page.captureScreenshot', { format: 'png', sessionId });
    fs.writeFileSync(process.argv[3], Buffer.from(res.data, 'base64'));
    console.log('saved', process.argv[3], fs.statSync(process.argv[3]).size, 'bytes');
    process.exit(0);
  } catch (e) { console.error('ERR:', e.message); process.exit(1); }
})();
