
export async function getRouteGeometry(points: [number, number][], profile: 'foot' | 'car' | 'bike' = 'foot'): Promise<[number, number][]> {
  if (points.length < 2) return points;
  
  // OSRM expects coordinates as lng,lat
  const coords = points.map(p => `${p[1]},${p[0]}`).join(';');
  
  let baseUrl = '';
  if (profile === 'foot') {
    baseUrl = 'https://routing.openstreetmap.de/routed-foot/route/v1/walking';
  } else if (profile === 'bike') {
    baseUrl = 'https://routing.openstreetmap.de/routed-bike/route/v1/cycling';
  } else {
    baseUrl = `https://router.project-osrm.org/route/v1/driving`;
  }

  const url = `${baseUrl}/${coords}?overview=full&geometries=geojson`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM request failed');
    const data = await res.json();
    
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
      // Map back to lat,lng
      return data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
    }
  } catch (e) {
    console.warn("OSRM routing failed, falling back to straight lines:", e);
  }
  return points;
}

