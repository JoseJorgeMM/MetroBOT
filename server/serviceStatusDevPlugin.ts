import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import { createServiceStatusHandler } from './serviceStatus';

export function serviceStatusDevPlugin(): Plugin {
  const handler = createServiceStatusHandler();
  const install = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/metro-status', async (req, res) => {
      try {
        const response = await handler(new Request('http://localhost/api/metro-status', { method: req.method }));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
      } catch { res.writeHead(503, { 'Cache-Control': 'no-store' }); res.end(); }
    });
  };
  return { name: 'metrobot-service-status', configureServer: install, configurePreviewServer: install };
}
