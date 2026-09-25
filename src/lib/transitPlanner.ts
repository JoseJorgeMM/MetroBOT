import type { RouteOption } from './routing';
import type { TripPoint } from './googleTransit';

const reasons: Record<string, string> = {
  NOT_CONFIGURED: 'Google aún no está activado.', CONFIGURATION: 'Google rechazó la configuración del servicio.',
  QUOTA: 'Se alcanzó un límite de consultas.', NO_ROUTES: 'Google no encontró recorridos disponibles.',
  TIMEOUT: 'Google tardó demasiado en responder.', UPSTREAM: 'El servicio de Google no está disponible.',
};
export async function requestGoogleRoutes(origin: TripPoint, destination: TripPoint): Promise<RouteOption[]> {
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()) throw Error('NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch('/api/transit-routes', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ origin: { lat: origin.lat, lng: origin.lng }, destination: { lat: destination.lat, lng: destination.lng } }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.code || 'UPSTREAM');
    if (!Array.isArray(result.routes)) throw Error('UPSTREAM');
    return result.routes.map((route: RouteOption) => ({ ...route, source: 'google', userOrigin: { ...origin, name: origin.name || 'Origen' }, userDest: { ...destination, name: destination.name || 'Destino' } }));
  } catch (error) {
    if (controller.signal.aborted) throw Error('TIMEOUT');
    throw error;
  } finally { window.clearTimeout(timer); }
}

export async function planTransit(origin: TripPoint, destination: TripPoint, providers: {
  google: () => Promise<RouteOption[]>; local: () => Promise<RouteOption[]>;
}): Promise<{ routes: RouteOption[]; notice: string }> {
  let reason = 'NO_ROUTES';
  try {
    const routes = await providers.google();
    if (routes.length) return { routes, notice: 'Google Maps · Salida ahora. Horarios estimados; confirma el servicio antes de abordar.' };
  } catch (error) { reason = error instanceof Error ? error.message : 'UPSTREAM'; }
  const notice = `${reasons[reason] || reasons.UPSTREAM} Usamos el respaldo local: cobertura limitada, sin horarios en vivo.`;
  // The local network is Medellín's SITVA, never fabricate a local route elsewhere.
  const inArea = (p: TripPoint) => p.lat >= 5.8 && p.lat <= 6.6 && p.lng >= -75.9 && p.lng <= -75.2;
  if (!inArea(origin) || !inArea(destination)) return { routes: [], notice };
  const routes = await providers.local();
  return { notice, routes: routes.map(route => ({ ...route, source: 'local', googlePolyline: undefined,
    steps: route.steps.map(step => ({ ...step, googlePolyline: undefined, transit: undefined })),
    userOrigin: { ...origin, name: origin.name || 'Origen' }, userDest: { ...destination, name: destination.name || 'Destino' },
  })) };
}
