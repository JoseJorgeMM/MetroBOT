async function test() {
  const query = "Cr 52 - Cl 117, Medellín";
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await globalThis.fetch(url, {
      headers: {
        'User-Agent': 'MetroBOT-Agent/1.0'
      }
    });
    const data = await res.json();
    console.log("Result:", data);
  } catch (e) {
    console.error(e);
  }
}

test();
