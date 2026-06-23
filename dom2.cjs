const WebSocket = require('ws');
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg)); });
}
(async () => {
  ws.on('message', (msg) => { const m = JSON.parse(msg.toString()); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); } });
  await new Promise(r => ws.on('open', r));
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  const t = await send('Target.createTarget', { url: 'http://127.0.0.1:3000/' });
  const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sid = att.sessionId;
  await send('Page.enable', {}, sid);
  await send('Runtime.enable', {}, sid);
  await new Promise(r => setTimeout(r, 18000));
  // Capture all console + exceptions during load.
  const events = [];
  ws.on('message', (msg) => {
    const m = JSON.parse(msg.toString());
    if (m.method === 'Runtime.consoleAPICalled') events.push('console:' + m.params.type + ':' + m.params.args.map(a => a.value).join(' '));
    if (m.method === 'Runtime.exceptionThrown') events.push('EXC:' + (m.params.exceptionDetails.text || JSON.stringify(m.params.exceptionDetails)));
  });
  // Now evaluate
  const dump = await send('Runtime.evaluate', { expression: 'document.body.innerHTML.length + " | root:" + (document.getElementById("root") ? document.getElementById("root").children.length : "no-root")', returnByValue: true }, sid);
  console.log('body len / root children:', dump.result.value);
  console.log('events captured (after attach):', events.length);
  for (const e of events.slice(0, 40)) console.log(' ', e.slice(0, 240));
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
