// split_pendientes.cjs
// -----------------------------------------------------------------------------
// Splits each .xlsx inside public/rutas_pendientes/ into ONE CSV per sheet,
// writing each output inside the corresponding subfolder of
// public/rutas_integradas/.
//
// Folder mapping (Excel file -> destination subfolder):
//   "TPC Barbosa.xlsx"                    -> TPC_Barbosa
//   "tpc caldas (1).xlsx"                 -> TPC_Caldas
//   "TPC COPACABANA.xlsx"                 -> TPC_Copacabana
//   "tpc niquia (2).xlsx"                 -> TPC_Niquia
//   "Rutas Integradas (Circulares).xlsx"  -> Rutas_Circulares
//   "SOLO BUS.xlsx"                       -> Solo_Bus
//
// Each sheet becomes "<id>.csv" where <id> is derived from the sheet name
// (e.g. "RUTA C7 001" -> "C7-001", "C9 002" -> "C9-002",
//  "T4 027 " -> "T4-027", "RUTA 142I" -> "142I", "C1R1" -> "C1R1").
// If the same id appears twice within one workbook, the second occurrence is
// suffixed with "_2", third with "_3", etc. (only happens for one pair today).
//
// CSVs follow the existing project format: CRLF line endings, "RUTA <id>" as
// the first line and one quoted stop name per remaining line.
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'public', 'rutas_pendientes');
const DEST_ROOT = path.join(ROOT, 'public', 'rutas_integradas');

const FOLDER_MAP = {
  'TPC Barbosa.xlsx': 'TPC_Barbosa',
  'tpc caldas (1).xlsx': 'TPC_Caldas',
  'TPC COPACABANA.xlsx': 'TPC_Copacabana',
  'tpc niquia (2).xlsx': 'TPC_Niquia',
  'Rutas Integradas (Circulares).xlsx': 'Rutas_Circulares',
  'SOLO BUS.xlsx': 'Solo_Bus',
};

function sanitizeId(rawName) {
  let s = String(rawName == null ? '' : rawName).trim();
  // Strip a leading "RUTA" / "RUTA " prefix.
  s = s.replace(/^RUTA\s+/i, '');
  // Collapse whitespace into single dash.
  s = s.replace(/\s+/g, '-');
  // Strip characters that are not safe in filenames.
  s = s.replace(/[^A-Za-z0-9._-]/g, '');
  // Trim leading/trailing dashes/dots.
  s = s.replace(/^[-.]+|[-.]+$/g, '');
  if (!s) s = 'ruta';
  return s;
}

function csvEscape(value) {
  const v = String(value == null ? '' : value).trim();
  if (v.length === 0) return '';
  // Always quote to match the existing CSVs.
  return '"' + v.replace(/"/g, '""') + '"';
}

// A "title row" is a single-cell row whose other cells are empty (used for
// descriptive headers like "RUTA C7 001 TCP BARBOSA"). We drop these.
function isTitleRow(row) {
  if (!row || row.length === 0) return false;
  const first = String(row[0] || '').trim();
  if (!first) return false;
  for (let i = 1; i < row.length; i++) {
    if (String(row[i] || '').trim().length > 0) return false;
  }
  return true;
}

// Bare "lat, lng" row -> skip, the compile pipeline re-geocodes names anyway.
function isCoordRow(row) {
  if (!row || row.length === 0) return false;
  const first = String(row[0] || '').trim();
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(first);
}

function writeCsv(filePath, headerLine, lines) {
  const body = [headerLine].concat(lines)
    .filter(l => l !== null && l !== undefined && l !== '')
    .join('\r\n') + '\r\n';
  fs.writeFileSync(filePath, body, { encoding: 'utf8' });
}

function processExcel(filePath, destFolder, options) {
  const wb = XLSX.readFile(filePath, { cellDates: false, cellNF: false, cellText: false });
  const outDir = path.join(DEST_ROOT, destFolder);
  fs.mkdirSync(outDir, { recursive: true });

  const summary = { folder: destFolder, sheets: [], skipped: [] };
  const seen = new Set();

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: true,
    });

    const cells = rows.map(r => (Array.isArray(r) ? r[0] : r))
                      .map(v => (v == null ? '' : String(v)));

    let startIdx = 0;
    while (startIdx < cells.length && cells[startIdx].trim() === '') startIdx++;
    if (startIdx < cells.length && isTitleRow(rows[startIdx])) {
      startIdx++;
      while (startIdx < cells.length && cells[startIdx].trim() === '') startIdx++;
    }

    const stops = [];
    for (let i = startIdx; i < cells.length; i++) {
      const text = cells[i].trim();
      if (!text) continue;
      if (isCoordRow(rows[i])) continue;
      stops.push(text);
    }

    if (stops.length < 2) {
      summary.skipped.push({ sheet: sheetName, reason: 'only ' + stops.length + ' stop(s) after cleanup' });
      continue;
    }

    const baseId = sanitizeId(sheetName);
    let id = baseId;
    if (seen.has(baseId)) {
      let n = 2;
      while (seen.has(baseId + '_' + n)) n++;
      id = baseId + '_' + n;
    }
    seen.add(id);

    const target = path.join(outDir, id + '.csv');
    const action = fs.existsSync(target) ? (options.overwrite ? 'updated' : 'kept') : 'written';
    if (action !== 'kept') {
      writeCsv(target, 'RUTA ' + id, stops.map(csvEscape));
    }
    summary.sheets.push({ sheet: sheetName, id: id, file: path.basename(target), stops: stops.length, action: action });
  }

  return summary;
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('Missing source dir: ' + SRC_DIR);
    process.exit(1);
  }
  if (!fs.existsSync(DEST_ROOT)) {
    console.error('Missing destination root: ' + DEST_ROOT);
    process.exit(1);
  }

  const overwrite = process.argv.includes('--force');

  const xlsxFiles = fs.readdirSync(SRC_DIR).filter(f => f.toLowerCase().endsWith('.xlsx'));
  if (xlsxFiles.length === 0) {
    console.log('No .xlsx files found in ' + SRC_DIR);
    return;
  }

  let totalSheets = 0;
  let totalCsvs = 0;
  for (const file of xlsxFiles) {
    const folder = FOLDER_MAP[file];
    if (!folder) {
      console.warn('[skip] No mapping for "' + file + '", leaving untouched.');
      continue;
    }
    const filePath = path.join(SRC_DIR, file);
    console.log('\n== ' + file + ' -> public/rutas_integradas/' + folder);
    const result = processExcel(filePath, folder, { overwrite: overwrite });
    totalSheets += result.sheets.length + result.skipped.length;
    totalCsvs += result.sheets.length;
    for (const s of result.sheets) {
      console.log('   [' + s.action + ']  ' + s.sheet.padEnd(18) + ' -> ' + s.file + '  (' + s.stops + ' stops)');
    }
    for (const s of result.skipped) {
      console.log('   [skip] ' + s.sheet.padEnd(18) + ' ' + s.reason);
    }
  }

  console.log('\nDone. Processed ' + totalSheets + ' sheets, wrote/kept ' + totalCsvs + ' CSVs.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
