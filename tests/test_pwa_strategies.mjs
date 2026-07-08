// tests/test_pwa_strategies.mjs
// Validates vite.config.ts PWA configuration contract.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

let pass = 0, fail = 0;
function assert(name, cond, hint) {
  if (cond) { pass++; console.log('  OK  ', name); }
  else { fail++; console.log('  FAIL', name, hint ? '(' + hint + ')' : ''); }
}

const cfg = fs.readFileSync(path.join('vite.config.ts'), 'utf8');

assert('VitePWA plugin registered', cfg.includes('VitePWA('));
assert('registerType prompt', /registerType:\s*['"]prompt['"]/.test(cfg));
assert('injectRegister auto', /injectRegister:\s*['"]auto['"]/.test(cfg));
assert('navigateFallback /offline.html', /navigateFallback:\s*['"]\/offline\.html['"]/.test(cfg));
assert('cleanupOutdatedCaches true', /cleanupOutdatedCaches:\s*true/.test(cfg));

// Parse runtimeCaching array into per-rule blocks.
const rules = [];
{
  const rcStart = cfg.indexOf('runtimeCaching:');
  if (rcStart !== -1) {
    const arrStart = cfg.indexOf('[', rcStart);
    if (arrStart !== -1) {
      let depth = 0, objStart = -1;
      for (let i = arrStart + 1; i < cfg.length; i++) {
        const c = cfg[i];
        if (c === '{') { if (depth === 0) objStart = i; depth++; }
        else if (c === '}') { depth--; if (depth === 0 && objStart !== -1) { rules.push(cfg.slice(objStart, i + 1)); objStart = -1; } }
        else if (c === ']' && depth === 0) break;
      }
    }
  }
}
console.log('  (parsed ' + rules.length + ' runtimeCaching rules)');

function extract(rule, key) {
  const idx = rule.indexOf(key + ':');
  if (idx === -1) return null;
  let rest = rule.slice(idx + key.length + 1).trim();
  if (rest[0] === "'" || rest[0] === '"') {
    const q = rest[0]; let j = 1;
    while (j < rest.length && rest[j] !== q) { if (rest[j] === '\\') j++; j++; }
    return { kind: 'string', value: rest.slice(1, j) };
  }
  if (rest[0] === '/') {
    let j = 1; while (j < rest.length && rest[j] !== '/') { if (rest[j] === '\\') j++; j++; }
    return { kind: 'regex', value: rest.slice(1, j) };
  }
  const m = rest.match(/\n\s+(handler|cacheName|options):/);
  const end = m ? m.index : rest.length;
  return { kind: 'fn', value: rest.slice(0, end).trim() };
}

function ruleHandler(rule) {
  const h = extract(rule, 'handler');
  if (!h) return null;
  if (h.kind === 'string') return h.value;
  return null;
}

function rulePattern(rule) { return extract(rule, 'urlPattern'); }
function findRule(matcher) { return rules.find(matcher) || null; }

function quotedStrings(src) {
  const out = [];
  const re = /['"]([A-Za-z0-9_./:-]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

// Strip backslash before dot so 'tiles\\.basemaps\\.cartocdn\\.com' becomes 'tiles.basemaps.cartocdn.com'.
function normalizeRegex(s) { const before = s; const result = s.replace(/\\./g, '.'); if (s !== result) console.log('  normalize: ' + s.slice(0, 80) + ' -> ' + result.slice(0, 80)); return result; }

const swrPatterns = ['rutas_integradas.json', 'Estaciones_.*.csv', 'tarifas_.*.csv', 'tiempos_.*.csv'];
for (const p of swrPatterns) {
  const re = new RegExp(p);
  const r = findRule((rule) => {
    if (ruleHandler(rule) !== 'StaleWhileRevalidate') return false;
    const pat = rulePattern(rule);
    if (!pat) return false;
    return re.test(normalizeRegex(pat.value));
  });
  assert('SWR rule for ' + p, !!r);
}

const cacheFirstFamilies = ['script', 'style', 'font', 'image'];
for (const fam of cacheFirstFamilies) {
  const r = findRule((rule) => {
    if (ruleHandler(rule) !== 'CacheFirst') return false;
    const p = rulePattern(rule);
    if (!p) return false;
    if (p.kind === 'regex') return quotedStrings(normalizeRegex(p.value)).indexOf(fam) !== -1;
    if (p.kind === 'fn') return quotedStrings(p.value).indexOf(fam) !== -1;
    return false;
  });
  assert('CacheFirst for ' + fam, !!r);
}

assert('NetworkFirst rule present', !!findRule((rule) => ruleHandler(rule) === 'NetworkFirst'));

function extractHostnames(rule) {
  const p = rulePattern(rule);
  if (!p) return [];
  const haystack = normalizeRegex(p.value || '');
  const out = [];
  // Match hostname with at least one dot and 2+ char TLD; allow a 2nd dot for subdomains like basemaps.cartocdn.com.
  const re = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*(?:\.[a-z]{2,})/g;
  let m;
  while ((m = re.exec(haystack)) !== null) {
    const t = m[0];
    if (/\.(destination|hostname|pathname|search|hash|href|protocol|searchParams)$/.test(t)) continue;
    if (t.indexOf('.') === -1) continue;
    out.push(t);
  }
  return out;
}
const networkOnlyHostnames = ['tiles.openstreetmap.org', 'basemaps.cartocdn.com', 'router.project-osrm.org', 'routing.openstreetmap.de', 'generativelanguage.googleapis.com'];
for (const host of networkOnlyHostnames) {
  const r = findRule((rule) => ruleHandler(rule) === 'NetworkOnly' && (() => {
    const p = rulePattern(rule);
    if (!p) return false;
    const haystack = normalizeRegex(p.value || '');
    return haystack.indexOf(host) !== -1;
  })());
  assert('NetworkOnly for ' + host, !!r);
}

assert('manifest name set', /name:\s*['"][^'"]+['"]/.test(cfg));
assert('manifest theme_color #00994C', /theme_color:\s*['"]#00994C['"]/.test(cfg) || /themeColor:\s*['"]#00994C['"]/.test(cfg));
assert('manifest icon-192 present', cfg.includes('icon-192.png'));
assert('manifest icon-512 present', cfg.includes('icon-512.png'));
assert('manifest maskable icon present', cfg.includes('icon-maskable'));
assert('devOptions enabled', /devOptions:\s*{[\s\S]*enabled:\s*true/.test(cfg));
// Build-time guard: vite-plugin-pwa with autoUpdate injects a self-reload
// path inside the generated sw.js. We must not see it now that we use 'prompt'.
let buildOk = true;
try {
  execSync('npm run build', { stdio: 'pipe' });
} catch (e) {
  buildOk = false;
  assert('build succeeds', false, 'npm run build failed');
  console.log('  (build output suppressed)');
}
if (buildOk) {
  const swPath = path.join('dist', 'sw.js');
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, 'utf8');
    const hasAutoReload = /skipWaiting[\s\S]{0,200}location\.reload/.test(sw)
      || /location\.reload[\s\S]{0,200}skipWaiting/.test(sw);
    assert('dist/sw.js does not contain autoUpdate skipWaiting+reload handler', !hasAutoReload);
  } else {
    assert('dist/sw.js exists after build', false, 'sw.js missing');
  }
}


console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); process.exit(1); }
