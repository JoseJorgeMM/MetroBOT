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
ws.on('open', async () => {
  try {
    await send('Runtime.enable');
    await send('Page.enable');
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
    const errs = await send('Runtime.evaluate', { expression: 'document.body.innerHTML.length', returnByValue: true });
    console.log('body html length:', errs.result.value);
    const sheets = await send('Runtime.evaluate', { expression: 'document.querySelectorAll("[id=app-bottom-sheet]").length', returnByValue: true });
    console.log('sheets:', sheets.result.value);
    const map = await send('Runtime.evaluate', { expression: 'document.querySelectorAll(".leaflet-container").length', returnByValue: true });
    console.log('leaflet containers:', map.result.value);
    console.log('captured', events.length, 'console events');
    for (const e of events) console.log(' ', e.level, '::', e.text.slice(0, 300));
    process.exit(0);
  } catch (e) { console.error(e.message); process.exit(1); }
});
ws.on('error', e => { console.error('ws:', e.message); process.exit(1); });
