const fs = require('fs');
const path = require('path');

const inputDir = 'C:\\Users\\ASUS\\Documents\\Rutas Integradas MetroBOT';
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));

function cleanStopName(name) {
  // Remove quotes
  let cleaned = name.replace(/^"|"$/g, '').trim();
  
  // Extract name before parentheses, e.g. "Br. Zamora (Cl 20d - Cr 42d, Bello)" -> "Br. Zamora"
  const parenIdx = cleaned.indexOf('(');
  if (parenIdx !== -1) {
    cleaned = cleaned.substring(0, parenIdx).trim();
  }
  
  // Extract name before street address, e.g. "Br. Guayabal Calle 12 Sur - Carrera 50e"
  // Let's split by common street terms: Calle, Carrera, Cra, Cl, Av, Avenida, #, Diagonal, Dg, Transversal, Tr
  const streetRegex = /\b(calle|carrera|cra|cl|av|avenida|diagonal|dg|transversal|tr|#)\b/i;
  const match = cleaned.match(streetRegex);
  if (match) {
    cleaned = cleaned.substring(0, match.index).trim();
  }
  
  // Clean trailing punctuation or spaces
  cleaned = cleaned.replace(/[-–,]+$/, '').trim();
  
  return cleaned;
}

const uniqueCleaned = new Set();
files.forEach(file => {
  const filePath = path.join(inputDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip coordinates lines
    if (line.match(/"?\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/)) continue;
    if (line.includes('°')) continue;
    
    const cleaned = cleanStopName(line);
    if (cleaned.length > 3) {
      uniqueCleaned.add(cleaned);
    }
  }
});

console.log(`Unique cleaned stops: ${uniqueCleaned.size}`);
console.log(Array.from(uniqueCleaned).slice(0, 50));
