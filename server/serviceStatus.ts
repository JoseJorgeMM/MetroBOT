import { parseServiceStatus, unavailableStatus } from '../src/lib/serviceStatus.js';

export function createServiceStatusHandler({ fetcher = fetch, now = Date.now, timeoutMs = 8000 }: {
  fetcher?: typeof fetch; now?: () => number; timeoutMs?: number;
} = {}) {
  return async (request: Request): Promise<Response> => {
    const headers = { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (request.method !== 'GET') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
    try {
      const upstream = await fetcher('https://www.metrodemedellin.gov.co/_hcms/api/semaforos', {
        signal: AbortSignal.timeout(timeoutMs), redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (!upstream.ok) throw Error('UPSTREAM_STATUS');
      // Limit the response before buffering; this is a small public line-status feed.
      const reader = upstream.body?.getReader();
      if (!reader) throw Error('EMPTY_STATUS');
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 64_000) { await reader.cancel(); throw Error('STATUS_TOO_LARGE'); }
        chunks.push(value);
      }
      const result = parseServiceStatus(JSON.parse(Buffer.concat(chunks).toString('utf8')), now());
      // Shared CDN cache, not process-local state; never serve stale-while-revalidate.
      return Response.json(result, { headers: { ...headers, 'Vercel-CDN-Cache-Control': 'public, s-maxage=300, must-revalidate' } });
    } catch {
      console.warn('Metro status: official source unavailable or invalid');
      return Response.json(unavailableStatus(now()), { status: 503, headers });
    }
  };
}
