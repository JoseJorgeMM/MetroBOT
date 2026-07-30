import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { PlaceValue } from '../TripPlannerPanel';
import {
  acceptMapSelectionTap,
  beginMapSelection,
  canDeliverMapSelection,
  createMapSelectionState,
  placeFromReverseGeocode,
  type MapSelectionMode,
} from './mapSelectionLogic';

interface MapSelectionControllerProps {
  mode: MapSelectionMode;
  onSelect: (mode: Exclude<MapSelectionMode, null>, place: PlaceValue) => void;
}

export function MapSelectionController({ mode, onSelect }: MapSelectionControllerProps) {
  const map = useMap();
  const selectionRef = useRef(createMapSelectionState(mode));
  const previousModeRef = useRef(mode);
  const [, setSelectionVersion] = useState(0);

  if (previousModeRef.current !== mode) {
    selectionRef.current = beginMapSelection(selectionRef.current, mode);
    previousModeRef.current = mode;
  }

  const activeMode = selectionRef.current.locked ? null : selectionRef.current.mode;

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeMode ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [activeMode, map]);

  useMapEvents({
    click: async ({ latlng }) => {
      const accepted = acceptMapSelectionTap(selectionRef.current);
      if (!accepted) return;

      selectionRef.current = accepted.state;
      setSelectionVersion((version) => version + 1);
      const { lat, lng } = latlng;
      let displayName: string | undefined;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        displayName = data.display_name;
      } catch (error) {
        console.error('Reverse geocoding failed', error);
      }

      if (canDeliverMapSelection(selectionRef.current, accepted.attempt)) {
        onSelect(accepted.attempt.mode, placeFromReverseGeocode(lat, lng, displayName));
      }
    },
  });

  return null;
}
