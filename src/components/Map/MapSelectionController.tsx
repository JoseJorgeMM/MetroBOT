import { useEffect, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { PlaceValue } from '../TripPlannerPanel';

interface MapSelectionControllerProps {
  mode: 'origin' | 'destination' | null;
  onSelect: (mode: 'origin' | 'destination', place: PlaceValue) => void;
}

export function MapSelectionController({ mode, onSelect }: MapSelectionControllerProps) {
  const map = useMap();
  const [selectionComplete, setSelectionComplete] = useState(false);
  const activeMode = selectionComplete ? null : mode;

  useEffect(() => {
    setSelectionComplete(false);
  }, [mode]);

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeMode ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [activeMode, map]);

  useMapEvents({
    click: async ({ latlng }) => {
      if (!activeMode) return;
      const { lat, lng } = latlng;
      let name = 'Punto seleccionado';
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        name = data.display_name ? data.display_name.split(',')[0] : name;
      } catch (error) {
        console.error('Reverse geocoding failed', error);
      }
      setSelectionComplete(true);
      onSelect(activeMode, { lat, lng, name });
    },
  });

  return null;
}
