import { Marker } from 'react-map-gl/maplibre';
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
 * an arrow that rotates with the device heading.
 */
export function UserLocationMarker({ position, heading }: UserLocationMarkerProps) {
  if (!position) return null;

  const rot = heading != null ? Math.round(heading) : null;

  return (
    <Marker latitude={position.lat} longitude={position.lng} anchor="center">
      <div className="user-location-marker" style={{ pointerEvents: 'none' }}>
        <div className="ulm-wrap">
          <div className="ulm-halo"></div>
          <div className="ulm-dot"></div>
          {rot != null ? (
            <div className="ulm-arrow" style={{ transform: `rotate(${rot}deg)` }}>
              ▲
            </div>
          ) : null}
        </div>
      </div>
    </Marker>
  );
}
