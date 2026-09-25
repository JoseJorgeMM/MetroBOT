import { mapGoogleRoutes, validPoint } from '../src/lib/googleTransit.ts';

const FIELD_MASK = [
  'routes.duration', 'routes.polyline.encodedPolyline',
  'routes.legs.steps.travelMode', 'routes.legs.steps.staticDuration',
  'routes.legs.steps.navigationInstruction', 'routes.legs.steps.polyline',
  'routes.legs.steps.transitDetails', 'routes.travelAdvisory.transitFare', 'routes.localizedValues.transitFare',
].join(',');

export function createTransitHandler({ key, enabled = true, fetcher = fetch, timeoutMs = 12000 }: {
  key?: string; enabled?: boolean; fetcher?: typeof fetch; timeoutMs?: number;
}) {
  // Best-effort per-instance protection, NOT a billing cap. Cloud quotas remain necessary.
  const clients = new Map<string, { count: number; expires: number }>();
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, body: unknown) => Response.json(body, { status, headers: {
      'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...(status === 405 ? { Allow: 'POST' } : {}),
    } });
    if (request.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' });
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return reply(403, { code: 'FORBIDDEN' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { code: 'JSON_REQUIRED' });
    let body;
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { code: 'INVALID_REQUEST' });
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4096) { await reader.cancel(); return reply(413, { code: 'REQUEST_TOO_LARGE' }); }
        chunks.push(chunk.value);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return reply(400, { code: 'INVALID_REQUEST' }); }
    if (!validPoint(body?.origin) || !validPoint(body?.destination)) return reply(400, { code: 'INVALID_COORDINATES' });
    if (!key?.trim() || !enabled) return reply(503, { code: 'NOT_CONFIGURED' });
    const now = Date.now();
    for (const [id, value] of clients) if (value.expires <= now) clients.delete(id);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const usage = clients.get(ip) || { count: 0, expires: now + 60000 };
    if (usage.count >= 20 || (!clients.has(ip) && clients.size >= 5000)) return reply(429, { code: 'QUOTA' });
    usage.count++; clients.set(ip, usage);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const waypoint = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
      const response = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST', signal: controller.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key.trim(), 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({ origin: waypoint(body.origin), destination: waypoint(body.destination),
          travelMode: 'TRANSIT', computeAlternativeRoutes: true, languageCode: 'es', units: 'METRIC',
        }),
      });
      if (!response.ok) return reply(response.status === 429 ? 429 : 502, { code: response.status === 429 ? 'QUOTA' : response.status === 403 || response.status === 401 ? 'CONFIGURATION' : 'UPSTREAM' });
      const routes = mapGoogleRoutes(await response.json(), { lat: body.origin.lat, lng: body.origin.lng }, { lat: body.destination.lat, lng: body.destination.lng });
      return routes.length ? reply(200, { routes }) : reply(404, { code: 'NO_ROUTES' });
    } catch { return reply(502, { code: controller.signal.aborted ? 'TIMEOUT' : 'UPSTREAM' }); }
    finally { clearTimeout(timer); }
  };
}
