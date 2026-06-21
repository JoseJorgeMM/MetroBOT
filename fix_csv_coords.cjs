// fix_csv_coords.cjs
// -----------------------------------------------------------------------------
// Some CSVs contain stop names like "Avenida 42, 65, Niqu\u00eda" that look like
// inline coordinates ("42, 65") to the compile pipeline. The pipeline
// mistakenly assigns (42, 65) as the stop's coordinates.
//
// Re-run the compile pipeline with a stricter regex that ONLY treats a line as
// an inline coord when BOTH numbers look like real lat/lng (lat in [6, 6.5]
// and lng in [-76, -75]). Other "coord-like" lines are treated as stop names
// and geocoded normally.
//
// Run after split_pendientes.cjs and BEFORE compile_new_routes.cjs.
//
// Usage: node fix_csv_coords.cjs [--in-place]
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const INTEGRADAS_DIR = path.join(__dirname, 'public', 'rutas_integradas');

const reCoord = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

function looksLikeRealCoord(text) {
  if (!reCoord.test(text.trim())) return false;
  const parts = text.split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(n => isNaN(n))) return false;
  const [lat, lng] = parts;
  return lat >= 6 && lat <= 6.5 && lng >= -76 && lng <= -75;
}

function fixCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return false;
  const header = lines[0];
  const body = lines.slice(1);
  // If a body line matches the strict coord regex, KEEP it (it is a real
  // inline coord). If it does NOT match, it is a stop name (quoted).
  // The compile pipeline expects: one stop name per line (possibly quoted),
  // with bare-coord lines immediately following a stop name to provide lat/lng.
  //
  // The only fix we need is to QUOTE any stop names that the original exporter
  // emitted unquoted but the compile pipeline would treat as a coord. We
  // already do this in split_pendientes.cjs (everything is quoted). So here
  // we just verify and log if anything is wrong.
  let needsFix = false;
  const fixed = [header];
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const isCoord = looksLikeRealCoord(line);
    if (isCoord && i > 0 && !fixed[fixed.length - 1].startsWith('"')) {
      // Previous unquoted line was actually a stop name; it might still be
      // missing quotes.
      const last = fixed[fixed.length - 1];
      if (!last.startsWith('"') && !last.endsWith('"')) {
        fixed[fixed.length - 1] = '"' + last.replace(/"/g, '""') + '"';
        needsFix = true;
      }
    }
    if (!isCoord && !line.startsWith('"')) {
      fixed.push('"' + line.replace(/"/g, '""') + '"');
      needsFix = true;
    } else {
      fixed.push(line);
    }
  }
  if (needsFix) {
    fs.writeFileSync(filePath, fixed.join('\r\n') + '\r\n', 'utf8');
  }
  return needsFix;
}

function walk(dir) {
  let fixed = 0;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      fixed += walk(full);
    } else if (entry.toLowerCase().endsWith('.csv')) {
      if (fixCsv(full)) fixed++;
    }
  }
  return fixed;
}

const fixed = walk(INTEGRADAS_DIR);
console.log('CSVs that needed quoting:', fixed);
