let pending: Promise<any> | undefined;

/** One SDK request per page. Only Maps JS: no billable Places autocomplete. */
export function loadGoogleMaps(): Promise<any> {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (pending) return pending;
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return Promise.reject(Error('Falta configurar VITE_GOOGLE_MAPS_API_KEY.'));
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const globals = window as unknown as Record<string, any>;
    const previousAuthFailure = globals.gm_authFailure;
    const cleanup = () => { clearTimeout(timer); globals.gm_authFailure = previousAuthFailure; };
    const fail = () => {
      cleanup(); script.remove(); pending = undefined;
      reject(Error('No se pudo cargar Google Maps. Revisa la clave, el dominio autorizado y Maps JavaScript API.'));
    };
    const timer = window.setTimeout(fail, 15000);
    globals.gm_authFailure = fail;
    globals.metroBotMapsReady = () => {
      cleanup();
      if (window.google?.maps?.Map) resolve(window.google.maps);
      else fail();
    };
    script.async = true;
    script.onerror = fail;
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: 'async', callback: 'metroBotMapsReady', language: 'es', region: 'CO', v: 'quarterly' })}`;
    document.head.append(script);
  });
  return pending;
}
