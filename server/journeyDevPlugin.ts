import type { Plugin, ViteDevServer } from 'vite';
import { createJourneyIntentHandler } from './journeyIntent.js';

/** Development and production share the same validation and provider implementation. */
export function journeyDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'metrobot-journey-intent-api',
    configureServer(server: ViteDevServer) {
      const handler = createJourneyIntentHandler({
        key: env.GEMINI_API_KEY?.trim() || env.GEMINI_API_KEYS?.split(',')[0]?.trim(),
        model: env.GEMINI_MODEL || undefined,
      });
      server.middlewares.use('/api/journey-intent', async (req, res) => {
        const cancellation = new AbortController();
        const onAborted = () => cancellation.abort();
        const onClosed = () => { if (!res.writableEnded) cancellation.abort(); };
        req.once('aborted', onAborted);
        res.once('close', onClosed);
        const fail = (status: number, code: string) => {
          res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
            'CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
          res.end(JSON.stringify({ code }));
        };
        // Stream into the Web handler so its single deadline includes the upload.
        // Do not destroy the socket on cancellation before the error response is sent.
        let detachBody = () => {};
        try {
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : new ReadableStream<Uint8Array>({
            start(controller) {
              const onData = (chunk: Buffer) => { controller.enqueue(new Uint8Array(chunk)); req.pause(); };
              const onEnd = () => { detachBody(); controller.close(); };
              const onError = (error: Error) => { detachBody(); controller.error(error); };
              detachBody = () => {
                req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.pause();
              };
              req.on('data', onData); req.once('end', onEnd); req.once('error', onError);
              req.pause();
            },
            pull() { req.resume(); },
            cancel() { detachBody(); },
          });
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
          const response = await handler(new Request(`http://${req.headers.host}/api/journey-intent`, {
            method: req.method, headers, signal: cancellation.signal,
            body, duplex: 'half',
          } as RequestInit));
          if (!req.complete) {
            res.setHeader('Connection', 'close');
            res.once('finish', () => req.destroy());
          }
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch { if (!res.headersSent) fail(500, 'UPSTREAM'); else res.end(); }
        finally {
          detachBody();
          req.off('aborted', onAborted);
          res.off('close', onClosed);
        }
      });
    },
  };
}
