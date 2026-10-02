import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStations } from '../src/lib/stations';

test('EnCicla preserves quoted addresses and capacity as metadata, not live availability', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes('En_Cicla') ? new Response('#,NOMBRE ESTACION,DIRECCION,MUNICIPIO,TIPO,TOTAL ANCLAJES,COORDENADAS\n1,Universidad,"Calle 73, esquina",Medellín,MANUAL,33,"6,26939;-75,56577"\n2,Invalid,X,X,MANUAL,2,"NaN;0"') : new Response('', { status: 404 });
  try {
    const stations = await loadStations();
    assert.equal(stations.length, 1);
    assert.equal(stations[0].address, 'Calle 73, esquina');
    assert.equal(stations[0].capacity, 33);
    assert.equal(stations[0].linea, 'Bicis');
    assert.equal(stations[0].stationType, 'MANUAL');
    assert.equal(stations[0].lat, 6.26939);
  } finally { globalThis.fetch = original; }
});
