import { isFreshStatus, unavailableStatus, type ServiceSnapshot } from './serviceStatus';

export function createServiceStatusClient({ fetcher = fetch, now = Date.now }: { fetcher?: typeof fetch; now?: () => number } = {}) {
  let cached: ServiceSnapshot | null = null;
  let inFlight: Promise<ServiceSnapshot> | null = null;
  let retryAfter = 0;
  return async (): Promise<ServiceSnapshot> => {
    if (cached && isFreshStatus(cached, now())) return cached;
    if (now() < retryAfter) return unavailableStatus(now());
    if (inFlight) return inFlight;
    inFlight = Promise.resolve().then(async () => {
      try {
        const response = await fetcher('/api/metro-status', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw Error('STATUS_UNAVAILABLE');
        const data: unknown = await response.json();
        if (!isFreshStatus(data, now())) throw Error('STATUS_EXPIRED_OR_INVALID');
        cached = data; return data;
      } catch {
        cached = null; retryAfter = now() + 30_000;
        return unavailableStatus(now());
      } finally { inFlight = null; }
    });
    return inFlight;
  };
}

// Lazy initialization keeps SSR and tests independent of browser fetch availability.
let client: ReturnType<typeof createServiceStatusClient> | undefined;
export function getServiceStatus() { return (client ??= createServiceStatusClient())(); }
