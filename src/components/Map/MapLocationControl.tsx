import { LocateControl } from './LocateControl';

type LocationFix = { lat: number; lng: number };

export interface LeafletMapLocationTarget {
  getZoom: () => number;
  flyTo: (center: [number, number], zoom: number, options?: { animate?: boolean }) => void;
}

export interface GeolocationSource {
  getCurrentPosition: (
    onSuccess: (position: { coords: { latitude: number; longitude: number } }) => void,
    onError?: (error: unknown) => void,
    options?: PositionOptions,
  ) => void;
}

const getBrowserGeolocation = (): GeolocationSource | null => (
  typeof navigator === 'undefined' ? null : navigator.geolocation
);

const getLeafletMap = (): LeafletMapLocationTarget | null => (
  typeof window === 'undefined' ? null : (window.leafletMap as LeafletMapLocationTarget | undefined) ?? null
);

export function requestMapLocation(
  map: LeafletMapLocationTarget | null,
  onFirstFix: (position: LocationFix) => void,
  onError?: () => void,
  geolocation: GeolocationSource | null = getBrowserGeolocation(),
) {
  if (!geolocation) {
    onError?.();
    return;
  }

  geolocation.getCurrentPosition(
    ({ coords }) => {
      const position = { lat: coords.latitude, lng: coords.longitude };
      map?.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 16), { animate: true });
      onFirstFix(position);
    },
    () => onError?.(),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
  );
}

export function MapLocationControl() {
  return (
    <LocateControl
      onRequestLocation={(onFirstFix, onError) => requestMapLocation(getLeafletMap(), onFirstFix, onError)}
    />
  );
}
