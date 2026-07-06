async function test(query) {
  const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  
  console.log(`=== Query: "${query}" ===`);
  try {
    const resP = await globalThis.fetch(photonUrl, { headers: { 'User-Agent': 'MetroBOT-Test/1.0' } });
    if (resP.ok) {
      const dataP = await resP.json();
      if (dataP && dataP.features && dataP.features.length > 0) {
        const f = dataP.features[0];
        console.log("  Photon:   ", { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], name: f.properties.name, city: f.properties.city });
      } else {
        console.log("  Photon:    No features found");
      }
    } else {
      console.log("  Photon:    HTTP error", resP.status);
    }
  } catch (e) {
    console.error("  Photon error:", e.message);
  }

  try {
    const resN = await globalThis.fetch(nominatimUrl, { headers: { 'User-Agent': 'MetroBOT-Test/1.0' } });
    if (resN.ok) {
      const dataN = await resN.json();
      if (dataN && dataN.length > 0) {
        console.log("  Nominatim:", { lat: parseFloat(dataN[0].lat), lng: parseFloat(dataN[0].lon), display_name: dataN[0].display_name });
      } else {
        console.log("  Nominatim: No results found");
      }
    } else {
      console.log("  Nominatim: HTTP error", resN.status);
    }
  } catch (e) {
    console.error("  Nominatim error:", e.message);
  }
  console.log("");
}

function cleanQuery(name) {
  let query = name;
  const addrMatch = name.match(/\(([^)]+)\)/);
  if (addrMatch) {
    query = addrMatch[1];
  }
  
  // Extract municipality if exists, or default to Medellín
  let city = 'Medellín';
  const cities = ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'Copacabana', 'Caldas', 'La Estrella', 'Barbosa', 'Girardota'];
  for (const c of cities) {
    const reg = new RegExp(c, 'i');
    if (name.match(reg)) {
      city = c;
      break;
    }
  }

  // Remove existing city/state suffixes from query part
  query = query.replace(/,\s*Medell[ií]n/gi, '')
               .replace(/,\s*Bello/gi, '')
               .replace(/,\s*Itag[uü][ií]/gi, '')
               .replace(/,\s*Envigado/gi, '')
               .replace(/,\s*Sabaneta/gi, '')
               .replace(/,\s*Copacabana/gi, '')
               .replace(/,\s*Caldas/gi, '')
               .replace(/,\s*La Estrella/gi, '')
               .replace(/,\s*Barbosa/gi, '')
               .replace(/,\s*Girardota/gi, '')
               .replace(/,\s*Antioquia/gi, '')
               .trim();

  // Expand abbreviations
  query = query
    .replace(/\bKr\b/gi, 'Carrera')
    .replace(/\bCra\b/gi, 'Carrera')
    .replace(/\bCr\b/gi, 'Carrera')
    .replace(/\bCl\b/gi, 'Calle')
    .replace(/\bCll\b/gi, 'Calle')
    .replace(/\bDiag\b/gi, 'Diagonal')
    .replace(/\bTv\b/gi, 'Transversal')
    .replace(/\bTrans\b/gi, 'Transversal')
    .replace(/\bAv\b\.?/gi, 'Avenida')
    .replace(/\s*-\s*/g, ' con ')
    .replace(/\s*&\s*/g, ' con ')
    .replace(/\s+/g, ' ')
    .trim();

  query += `, ${city}`;
  return query;
}

async function run() {
  const testNames = [
    "Kr 83 - Cl 5, Medellín",
    "Avenida 80 - Calle 32b",
    "Belen La Palma Avenida. 80",
    "Cl 55 - Cr 16, Medellín",
    "Cr 17b - Cl 56e, Medellín",
    "Cr 13 - Cl 52b, Medellín"
  ];

  for (const name of testNames) {
    const cleaned = cleanQuery(name);
    console.log(`Original: "${name}"`);
    console.log(`Cleaned:  "${cleaned}"`);
    await test(cleaned);
  }
}

run();
