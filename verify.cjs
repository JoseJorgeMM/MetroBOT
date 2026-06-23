const http = require('http');
const fetch = (url) => new Promise((resolve, reject) => { http.get(url, (res) => { let body = ""; res.on("data", c => body += c); res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers })); }).on("error", reject); });
(async () => {
  const r = await fetch("http://127.0.0.1:3000/src/App.tsx");
  const checks = [
    ["lg:hidden (breakpoint)", "lg:hidden"],
    ["lg:flex-row (layout)", "lg:flex-row"],
    ["lg:w-[28rem] (sheet width)", "lg:w-[28rem]"],
    ["h-[58dvh] (mid height)", "h-[58dvh]"],
    ["h-[72px] (min height)", "h-[72px]"],
    ["h-[92dvh] (max height)", "h-[92dvh]"],
    ["min-h-[44px] (tap target)", "min-h-[44px]"],
    ["min-h-[48px] (form button)", "min-h-[48px]"],
    ["w-12 h-12 (send button)", "w-12 h-12"],
    ["DISCLAIMER_STORAGE_KEY", "DISCLAIMER_STORAGE_KEY"],
    ["dismissDisclaimer", "dismissDisclaimer"],
    ["disclaimerDismissed", "disclaimerDismissed"],
    ["aria-label=Ayuda", "aria-label=\"Ayuda\""],
    ["aria-label=Tema", "aria-label=\"Tema\""],
    ["aria-label=Enviar", "aria-label=\"Enviar\""],
    ["aria-label=Entendido", "aria-label=\"Entendido\""],
  ];
  let pass = 0, fail = 0;
  for (const [name, needle] of checks) {
    const ok = r.body.indexOf(needle) !== -1;
    console.log((ok ? "  OK   " : "  MISS ") + name + " (" + needle + ")");
    if (ok) pass++; else fail++;
  }
  console.log("--- " + pass + "/" + (pass+fail) + " checks passed");
  process.exit(fail === 0 ? 0 : 1);
})();
