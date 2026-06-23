const WebSocket = require('ws');
const fs = require('fs');
const wsUrl = process.argv[2];
const out = process.argv[3];
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
      if (m.method === 'Runtime.exceptionThrown') {
        events.push({ level: 'EXCEPTION', text: JSON.stringify(m.params.exceptionDetails) });
      }
    });
    await new Promise(r => ws.on('open', r));
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:3000/' });
    await new Promise(r => setTimeout(r, 6000));
    const len = await send('Runtime.evaluate', { expression: 'document.body.innerHTML.length', returnByValue: true });
    console.log('html length:', len.result.value);
    const sheets = await send('Runtime.evaluate', { expression: 'document.querySelectorAll("[id=app-bottom-sheet]").length', returnByValue: true });
    console.log('sheets:', sheets.result.value);
    const map = await send('Runtime.evaluate', { expression: 'document.querySelectorAll(".leaflet-container").length', returnByValue: true });
    console.log('leaflet:', map.result.value);
    console.log('console events:', events.length);
    for (const e of events.slice(0, 30)) console.log(' ', e.level, '::', e.text.slice(0, 400));
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
    console.log('saved', out, fs.statSync(out).size, 'bytes');
    process.exit(0);
  } catch (e) { console.error('ERR:', e.message); process.exit(1); }
})();
