import type { TripPoint } from './googleTransit';

export type MapPointKind = 'origin' | 'destination' | 'station';
const icons: Record<MapPointKind, string> = {
  origin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  destination: '<path d="M4 22V3m0 1c5-4 10 4 16 0v11c-6 4-11-4-16 0"/>',
  station: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 10h14M8 21l2-3m6 3-2-3M9 14h.01M15 14h.01"/>',
};

/** A screen-space marker: draw updates position only, never dimensions. */
export function createMapPointOverlay(maps: any, map: any, point: TripPoint, kind: MapPointKind, label: string, onClick?: (button: HTMLButtonElement) => void) {
  const element = document.createElement(onClick ? 'button' : 'div');
  element.className = 'metro-map-point';
  element.title = label;
  element.setAttribute('aria-label', label);
  if (onClick) element.setAttribute('type', 'button');
  else element.setAttribute('role', 'img');
  // All SVG content comes from the constant icon table, never provider/user text.
  element.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[kind]}</svg>`;
  Object.assign(element.style, {
    position: 'absolute', width: '44px', height: '44px', padding: '0', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: 'translate(-50%, -100%)', borderRadius: kind === 'station' ? '14px' : '50% 50% 50% 8px',
    border: '3px solid white', background: kind === 'origin' ? '#2563eb' : kind === 'destination' ? '#be123c' : '#065f46',
    color: 'white', boxShadow: '0 3px 10px #0f172a40', cursor: onClick ? 'pointer' : 'default',
    zIndex: kind === 'station' ? '10' : '20', pointerEvents: onClick ? 'auto' : 'none',
  });
  const click = () => onClick?.(element as HTMLButtonElement);
  if (onClick) element.addEventListener('click', click);
  const overlay = new maps.OverlayView();
  overlay.onAdd = () => {
    overlay.getPanes().overlayMouseTarget.appendChild(element);
    maps.OverlayView.preventMapHitsAndGesturesFrom(element);
  };
  overlay.draw = () => {
    const position = overlay.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(point.lat, point.lng));
    if (position) { element.style.left = `${position.x}px`; element.style.top = `${position.y}px`; }
  };
  overlay.onRemove = () => { element.removeEventListener('click', click); element.remove(); };
  overlay.setMap(map);
  return overlay;
}
