const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
let orig = fs.readFileSync('src/lib/gemini.ts', 'utf8');
const oldClose = "where this step occurs or ends. Only nameRef is accepted; coordinates are filled from the catalog.'" + CRLF + "                  }";
const newClose =
  "where this step occurs or ends. Only nameRef is accepted; coordinates are filled from the catalog.'" + CRLF +
  "                  }," + CRLF +
  "                  _evidence: {" + CRLF +
  "                    type: Type.OBJECT," + CRLF +
  "                    description: 'Citation: source catalog entry for this step (anti-hallucination).'," + CRLF +
  "                    properties: {" + CRLF +
  "                      sourceRouteId: { type: Type.STRING, description: 'Exact route id from the catalog.' }," + CRLF +
  "                      sourceStopName: { type: Type.STRING, description: 'Exact stop name from the catalog.' }" + CRLF +
  "                    }" + CRLF +
  "                  }";
if (orig.indexOf(oldClose) === -1) { console.log('NOT FOUND'); process.exit(1); }
orig = orig.replace(oldClose, newClose);
fs.writeFileSync('src/lib/gemini.ts', orig, 'utf8');
console.log('patched', orig.length);
