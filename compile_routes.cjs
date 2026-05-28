const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\ASUS\\Documents\\Rutas Integradas MetroBOT';
const destDir = 'c:\\Users\\ASUS\\Documents\\MetroBOT\\public\\rutas_integradas';
const jsonPath = 'c:\\Users\\ASUS\\Documents\\MetroBOT\\public\\rutas_integradas.json';

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 1. Copy all CSV files
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.csv'));
files.forEach(file => {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
});
console.log(`Copied ${files.length} CSV files to public/rutas_integradas`);

// 2. Load official stations for matching
const metroStationsFile = 'c:\\Users\\ASUS\\Documents\\MetroBOT\\public\\Estaciones_Sistema_Metro.csv';
const enciclaStationsFile = 'c:\\Users\\ASUS\\Documents\\MetroBOT\\public\\Estaciones_En_Cicla.csv';

const officialStations = [];

// Parse Metro stations
if (fs.existsSync(metroStationsFile)) {
  const content = fs.readFileSync(metroStationsFile, 'utf-8');
  const rows = content.trim().split('\n').slice(1);
  const RADIUS = 6378137;
  rows.forEach(row => {
    const cols = row.split(',');
    if (cols.length < 9) return;
    const x = parseFloat(cols[0]);
    const y = parseFloat(cols[1]);
    
    // mercatorToWgs84
    const lng = (x / RADIUS) * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    
    const nombre = cols[6] ? cols[6].replace(/^Estación /, '').replace(/ \(Línea .*\)$/, '').trim() : '';
    officialStations.push({ nombre, lat, lng });
  });
}

// Predefined neighborhood/key coordinates dictionary
const neighborhoodCoords = {
  'zamora': { lat: 6.307, lng: -75.556 },
  'playon': { lat: 6.311, lng: -75.564 },
  'el playon': { lat: 6.311, lng: -75.564 },
  'castilla': { lat: 6.295, lng: -75.578 },
  'pedregal': { lat: 6.292, lng: -75.586 },
  'doce de octubre': { lat: 6.304, lng: -75.582 },
  'san cristobal': { lat: 6.258, lng: -75.632 },
  'belen rincon': { lat: 6.216, lng: -75.602 },
  'belen el rincon': { lat: 6.216, lng: -75.602 },
  'el rincon': { lat: 6.216, lng: -75.602 },
  'belen': { lat: 6.228, lng: -75.597 },
  'guayabal': { lat: 6.208, lng: -75.584 },
  'la palma': { lat: 6.231, lng: -75.592 },
  'la mota': { lat: 6.212, lng: -75.594 },
  'rodeo': { lat: 6.207, lng: -75.591 },
  'campos de paz': { lat: 6.207, lng: -75.591 },
  'bulerias': { lat: 6.239, lng: -75.589 },
  'unicentro': { lat: 6.239, lng: -75.590 },
  'robledo': { lat: 6.273, lng: -75.591 },
  'oriente': { lat: 6.234, lng: -75.541 },
  'villatina': { lat: 6.235, lng: -75.544 },
  'alejandro echavarria': { lat: 6.232, lng: -75.548 },
  'liliam': { lat: 6.239, lng: -75.542 },
  'villa liliam': { lat: 6.239, lng: -75.542 }
};

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

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchStationCoords(name) {
  const norm = normalizeName(name);
  // Try exact match or contains match
  for (const station of officialStations) {
    const sNorm = normalizeName(station.nombre);
    if (norm === sNorm || norm.includes(sNorm) || sNorm.includes(norm)) {
      return { lat: station.lat, lng: station.lng };
    }
  }
  return null;
}

function matchNeighborhoodCoords(name) {
  const norm = normalizeName(name);
  for (const [key, coords] of Object.entries(neighborhoodCoords)) {
    if (norm.includes(key)) {
      return { ...coords };
    }
  }
  return null;
}

const compiledRoutes = [];

files.forEach(file => {
  const filePath = path.join(srcDir, file);
  const routeId = file.replace('.csv', '');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  const rawStops = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const coords = parseCoords(line);
    if (coords) {
      // This is a coordinate line, associate it with the last added stop
      if (rawStops.length > 0) {
        rawStops[rawStops.length - 1].lat = coords.lat;
        rawStops[rawStops.length - 1].lng = coords.lng;
        rawStops[rawStops.length - 1].hasCoords = true;
      }
    } else {
      const cleanName = line.replace(/^"|"$/g, '').trim();
      rawStops.push({
        name: cleanName,
        lat: null,
        lng: null,
        hasCoords: false
      });
    }
  }
  
  // Geocode using station matching and neighborhood matching
  rawStops.forEach(stop => {
    if (stop.hasCoords) return;
    
    // Try matching station
    const stationCoords = matchStationCoords(stop.name);
    if (stationCoords) {
      stop.lat = stationCoords.lat;
      stop.lng = stationCoords.lng;
      stop.hasCoords = true;
      return;
    }
    
    // Try matching neighborhood
    const nhCoords = matchNeighborhoodCoords(stop.name);
    if (nhCoords) {
      // Add slight random offset to prevent exact duplicate coordinates for overlapping stops
      stop.lat = nhCoords.lat + (Math.random() - 0.5) * 0.001;
      stop.lng = nhCoords.lng + (Math.random() - 0.5) * 0.001;
      stop.hasCoords = true;
    }
  });

  // Interpolate missing coordinates
  // We need at least some coordinates to interpolate. If none have coordinates (very rare, as they should connect to a station),
  // we'll assign a default central coordinate of Medellin.
  const knownIndices = [];
  rawStops.forEach((stop, idx) => {
    if (stop.hasCoords) knownIndices.push(idx);
  });

  if (knownIndices.length === 0) {
    // Fallback: use Acevedo for C6, Aguacatala for C3
    const fallbackCoords = routeId.startsWith('C6') 
      ? { lat: 6.2995, lng: -75.5684 } 
      : { lat: 6.1957, lng: -75.5826 };
    rawStops.forEach(stop => {
      stop.lat = fallbackCoords.lat;
      stop.lng = fallbackCoords.lng;
      stop.hasCoords = true;
    });
  } else {
    // Linear interpolation between known coordinate indices
    for (let i = 0; i < rawStops.length; i++) {
      if (rawStops[i].hasCoords) continue;

      // Find nearest known stop before i (handling wrapping because it's a loop)
      let prevIdx = -1;
      let nextIdx = -1;

      // Find next index after i
      for (let j = i + 1; j < rawStops.length; j++) {
        if (rawStops[j].hasCoords) {
          nextIdx = j;
          break;
        }
      }
      if (nextIdx === -1) {
        nextIdx = knownIndices[0]; // wraps around to first known
      }

      // Find prev index before i
      for (let j = i - 1; j >= 0; j--) {
        if (rawStops[j].hasCoords) {
          prevIdx = j;
          break;
        }
      }
      if (prevIdx === -1) {
        prevIdx = knownIndices[knownIndices.length - 1]; // wraps around to last known
      }

      // Calculate fraction of distance
      let distTotal, distFromPrev;
      if (nextIdx > prevIdx) {
        distTotal = nextIdx - prevIdx;
        distFromPrev = i - prevIdx;
      } else {
        // wrapping
        distTotal = (rawStops.length - prevIdx) + nextIdx;
        distFromPrev = i > prevIdx ? (i - prevIdx) : ((rawStops.length - prevIdx) + i);
      }

      const fraction = distFromPrev / distTotal;

      const pLat = rawStops[prevIdx].lat;
      const pLng = rawStops[prevIdx].lng;
      const nLat = rawStops[nextIdx].lat;
      const nLng = rawStops[nextIdx].lng;

      rawStops[i].lat = pLat + (nLat - pLat) * fraction;
      rawStops[i].lng = pLng + (nLng - pLng) * fraction;
      rawStops[i].hasCoords = true;
    }
  }

  compiledRoutes.push({
    id: routeId,
    name: `Ruta Integrada ${routeId}`,
    stops: rawStops.map(s => ({
      name: s.name,
      lat: s.lat,
      lng: s.lng
    }))
  });
});

fs.writeFileSync(jsonPath, JSON.stringify(compiledRoutes, null, 2));
console.log(`Compiled all routes into ${jsonPath}. Success!`);
