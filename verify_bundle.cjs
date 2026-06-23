const fs = require('fs');
const bundlePath = 'dist/assets/' + fs.readdirSync('dist/assets').find(f => f.endsWith('.js'));
const b = fs.readFileSync(bundlePath, 'utf8');
const probes = [
  ['Iniciar navegacion', 'Iniciar navegacion'],
  ['Navegacion activa', 'Navegacion activa'],
  ['Compartir ruta', 'Compartir ruta'],
  ['metrobot.favorites.v1', 'metrobot.favorites.v1'],
  ['metrobot.history.v1', 'metrobot.history.v1'],
  ['buildShareText impl present', 'Ruta MetroBOT: '],
  ['QuickPicksBar', 'Favoritos'],
  ['Recentes label', 'Recientes'],
  ['vibrate call', 'vibrate'],
  ['navigator.share', 'share'],
  ['clipboard.writeText', 'writeText'],
];
let pass = 0, fail = 0;
for (const [name, needle] of probes) {
  const present = b.indexOf(needle) !== -1;
  console.log((present ? "  OK   " : "  MISS ") + name + " (" + needle + ")");
  if (present) pass++; else fail++;
}
console.log("--- " + pass + "/" + (pass + fail) + " markers found");
process.exit(fail === 0 ? 0 : 1);
