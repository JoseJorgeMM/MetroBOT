import { useEffect } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '../../lib/geo';

interface UserLocationMarkerProps {
  /** Current position; if null, the marker is not rendered. */
  position: LatLng | null;
  /** Heading in degrees [0,360). Null = unknown (show a dot, no arrow). */
  heading: number | null;
  /** When true, keep the map centered on the user (follow mode). */
  follow?: boolean;
}

/**
 * Google-Maps-style "blue dot" user location marker with an accuracy halo and
 * an arrow that rotates with the device heading. Pure CSS rotation on a
 * divIcon — no extra leaflet plugin required.
 */
export function UserLocationMarker({ position, heading, follow }: UserLocationMarkerProps) {
  const map = useMap();

  useEffect(() => {
    if (position && follow) {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
    }
  }, [position, follow, map]);

  if (!position) return null;

  const rot = heading != null ? Math.round(heading) : null;
  const icon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="ulm-wrap">
        <div class="ulm-halo"></div>
        <div class="ulm-dot"></div>
        ${rot != null ? `<div class="ulm-arrow" style="transform: rotate(${rot}deg)">▲</div>` : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return <Marker position={[position.lat, position.lng]} icon={icon} zIndexOffset={1000} interactive={false} />;
}
