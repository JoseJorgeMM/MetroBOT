import type { Plugin, ViteDevServer } from 'vite';
import { createTransitHandler } from './transit';

/** Development uses the same handler as the Vercel Function; no second server. */
export function transitDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'metrobot-transit-api',
    configureServer(server: ViteDevServer) {
      const handler = createTransitHandler({ key: env.GOOGLE_ROUTES_API_KEY, enabled: env.GOOGLE_TRANSIT_ENABLED !== 'false' });
      server.middlewares.use('/api/transit-routes', async (req, res) => {
        try {
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 4096) { res.writeHead(413, { 'Cache-Control': 'no-store' }); res.end(); return; }
            chunks.push(Buffer.from(chunk));
          }
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
          const response = await handler(new Request(`http://${req.headers.host}/api/transit-routes`, {
            method: req.method, headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          }));
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch { res.writeHead(500, { 'Cache-Control': 'no-store' }); res.end('{"code":"UPSTREAM"}'); }
      });
    },
  };
}
