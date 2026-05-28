const fs = require('fs');
const path = require('path');

const inputDir = 'C:\\Users\\ASUS\\Documents\\Rutas Integradas MetroBOT';
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));

function parseCoords(line) {
  const decMatch = line.match(/"?\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*"?/);
  if (decMatch) return { lat: parseFloat(decMatch[1]), lng: parseFloat(decMatch[2]) };

  const dmsRegex = /"?\s*(\d+)°(\d+)'([\d.]+)"?\s*([NS])\s*(\d+)°(\d+)'([\d.]+)"?\s*([EW])\s*"?/i;
  const dmsMatch = line.match(dmsRegex);
  if (dmsMatch) {
    let lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2])/60 + parseFloat(dmsMatch[3])/3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    let lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6])/60 + parseFloat(dmsMatch[7])/3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
    return { lat, lng };
  }
  return null;
}

const uniqueStops = new Set();
let totalStops = 0;
let stopsWithCoords = 0;

files.forEach(file => {
  const filePath = path.join(inputDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const coords = parseCoords(line);
    if (coords) {
      stopsWithCoords++;
    } else {
      // It's a stop name or address
      // If the NEXT line is a coordinate, then this stop has coordinates.
      const nextLine = lines[i+1];
      const hasNextCoords = nextLine ? parseCoords(nextLine) !== null : false;
      if (!hasNextCoords) {
        // This is a stop without coordinates
        // Clean the name (remove quotes)
        const cleanName = line.replace(/^"|"$/g, '').trim();
        uniqueStops.add(cleanName);
      }
      totalStops++;
    }
  }
});

console.log(`Total stop entries across all files: ${totalStops}`);
console.log(`Stops with coordinates: ${stopsWithCoords}`);
console.log(`Unique stops without coordinates: ${uniqueStops.size}`);
console.log("Sample unique stops without coordinates:");
console.log(Array.from(uniqueStops).slice(0, 20));
