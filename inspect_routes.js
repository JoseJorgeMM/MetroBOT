const fs = require('fs');
const path = require('path');

const inputDir = 'C:\\Users\\ASUS\\Documents\\Rutas Integradas MetroBOT';
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));

console.log(`Found ${files.length} CSV files.`);

// A simple parser to extract coordinates from string
function parseCoords(line) {
  // Try matching decimal coords: "6.12345, -75.12345"
  const decMatch = line.match(/"?\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*"?/);
  if (decMatch) {
    return {
      lat: parseFloat(decMatch[1]),
      lng: parseFloat(decMatch[2])
    };
  }

  // Try matching DMS: "6°11'58.7"N 75°35'05.3"W" or similar
  // Regex to match degrees, minutes, seconds
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

const stats = [];

files.forEach(file => {
  const filePath = path.join(inputDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let coordCount = 0;
  const stops = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const coords = parseCoords(line);
    if (coords) {
      coordCount++;
    }
  }
  
  stats.push({
    file,
    lineCount: lines.length,
    coordCount
  });
});

console.log(JSON.stringify(stats, null, 2));
