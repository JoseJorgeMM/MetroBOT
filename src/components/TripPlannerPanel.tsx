import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Locate, MapPin, MousePointerClick, Search, X } from 'lucide-react';

export type PlaceValue = { lat: number; lng: number; name: string };

type SearchResult = {
  place_id: string | number;
  lat: string;
  lon: string;
  display_name: string;
  isGoogle?: boolean;
};

interface TripPlannerPanelProps {
  origin: PlaceValue | null;
  destination: PlaceValue | null;
  busesEnabled: boolean;
  isLoading: boolean;
  onOriginChange: (place: PlaceValue | null) => void;
  onDestinationChange: (place: PlaceValue | null) => void;
  onBusesEnabledChange: (enabled: boolean) => void;
  onRequestMapSelection: (mode: 'origin' | 'destination') => void;
  onSubmit: () => void;
  onClose: () => void;
}

const fieldLabel = (field: 'origin' | 'destination') => field === 'origin' ? 'Origen' : 'Destino';

function normalizeQuery(text: string) {
  const lower = text.toLowerCase();
  return lower.includes('medellin') || lower.includes('medellín') || lower.includes('antioquia')
    ? text
    : `${text}, Medellín, Antioquia`;
}

function displayName(value: PlaceValue | null) {
  return value?.name ?? '';
}

export function TripPlannerPanel({
  origin,
  destination,
  busesEnabled,
  isLoading,
  onOriginChange,
  onDestinationChange,
  onBusesEnabledChange,
  onRequestMapSelection,
  onSubmit,
  onClose,
}: TripPlannerPanelProps) {
  const [originQuery, setOriginQuery] = useState(() => displayName(origin));
  const [destinationQuery, setDestinationQuery] = useState(() => displayName(destination));
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOriginQuery(displayName(origin));
  }, [origin]);

  useEffect(() => {
    setDestinationQuery(displayName(destination));
  }, [destination]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const updatePlace = (field: 'origin' | 'destination', place: PlaceValue | null) => {
    if (field === 'origin') onOriginChange(place);
    else onDestinationChange(place);
  };

  const search = async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    if (window.google?.maps?.places) {
      try {
        const service = new google.maps.places.AutocompleteService();
        const predictions = await new Promise<google.maps.places.AutocompletePrediction[] | null>((resolve) => {
          service.getPlacePredictions({
            input: text,
            location: new google.maps.LatLng(6.2442, -75.5812),
            radius: 50000,
            componentRestrictions: { country: 'co' },
          }, resolve);
        });
        if (predictions?.length) {
          setResults(predictions.map((prediction) => ({
            place_id: prediction.place_id,
            display_name: prediction.description,
            lat: '0',
            lon: '0',
            isGoogle: true,
          })));
          setIsSearching(false);
          return;
        }
      } catch (error) {
        console.error('Google SDK Search error:', error);
      }
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizeQuery(text))}&limit=8&addressdetails=1&countrycodes=co`,
      );
      setResults(await response.json());
    } catch (error) {
      console.error('Nominatim search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInput = (field: 'origin' | 'destination', value: string) => {
    if (field === 'origin') setOriginQuery(value);
    else setDestinationQuery(value);
    updatePlace(field, null);
    setActiveField(field);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => void search(value), 600);
  };

  const applySelection = (field: 'origin' | 'destination', place: PlaceValue) => {
    if (field === 'origin') setOriginQuery(place.name);
    else setDestinationQuery(place.name);
    updatePlace(field, place);
    setResults([]);
  };

  const handleResultSelect = async (result: SearchResult) => {
    let lat = Number.parseFloat(result.lat);
    let lng = Number.parseFloat(result.lon);
    const name = result.display_name.split(',')[0];

    if (result.isGoogle) {
      setIsSearching(true);
      try {
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        const location = await new Promise<any>((resolve, reject) => {
          service.getDetails({ placeId: result.place_id }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
              resolve(place.geometry.location);
            } else {
              reject(status);
            }
          });
        });
        lat = location.lat();
        lng = location.lng();
      } catch (error) {
        console.error('Error fetching Google place details:', error);
        return;
      } finally {
        setIsSearching(false);
      }
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      applySelection(activeField, { lat, lng, name });
    }
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }

    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        let name = 'Mi ubicación actual';
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          const data = await response.json();
          name = data.display_name ? data.display_name.split(',')[0] : name;
        } catch (error) {
          console.error('Reverse geocoding failed', error);
        } finally {
          applySelection(activeField, { lat, lng, name });
          setIsSearching(false);
        }
      },
      (error) => {
        setIsSearching(false);
        console.error(error);
        alert('No se pudo obtener tu ubicación. Verifica los permisos de tu navegador.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const swapFields = () => {
    const nextOrigin = destination;
    const nextDestination = origin;
    setOriginQuery(displayName(nextOrigin));
    setDestinationQuery(displayName(nextDestination));
    onOriginChange(nextOrigin);
    onDestinationChange(nextDestination);
  };

  const isBusy = isLoading || isSearching;
  const canSubmit = Boolean(origin && destination);
  const query = activeField === 'origin' ? originQuery : destinationQuery;

  return (
    <section aria-label="Planificador de viaje" className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Planificar viaje</h2>
        <button type="button" aria-label="Cerrar planificador" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {(['origin', 'destination'] as const).map((field) => {
            const value = field === 'origin' ? originQuery : destinationQuery;
            return (
              <label key={field} className="block">
                <span className="mb-1 block text-sm font-semibold text-foreground">{fieldLabel(field)}</span>
                <div className="relative">
                  <MapPin className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${field === 'origin' ? 'text-sitva-green' : 'text-rose-500'}`} />
                  <input
                    aria-label={fieldLabel(field)}
                    value={value}
                    onFocus={() => setActiveField(field)}
                    onChange={(event) => handleInput(field, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && results[0]) void handleResultSelect(results[0]);
                    }}
                    placeholder={field === 'origin' ? 'Elige un punto de partida' : 'Elige un destino'}
                    className="min-h-11 w-full rounded-xl border border-border bg-input py-2 pl-10 pr-10 text-sm outline-none focus:border-sitva-blue focus:ring-2 focus:ring-sitva-blue/20"
                  />
                  {value && (
                    <button type="button" aria-label={`Limpiar ${fieldLabel(field).toLowerCase()}`} onClick={() => handleInput(field, '')} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </label>
            );
          })}
        </div>
        <button type="button" aria-label="Intercambiar origen y destino" title="Intercambiar origen y destino" onClick={swapFields} className="mt-6 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowDownUp className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={requestCurrentLocation} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-sitva-blue hover:bg-blue-50 dark:hover:bg-blue-950/20">
          <Locate className="h-4 w-4" />
          Usar mi ubicación
        </button>
        <button type="button" onClick={() => onRequestMapSelection(activeField)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-foreground hover:bg-slate-50 dark:hover:bg-slate-800">
          <MousePointerClick className="h-4 w-4 text-sitva-blue" />
          Seleccionar en el mapa
        </button>
      </div>

      {activeField && (results.length > 0 || query) && (
        <div role="listbox" aria-label={`Resultados para ${fieldLabel(activeField).toLowerCase()}`} className="max-h-52 overflow-y-auto rounded-xl border border-border bg-card shadow-sm">
          {results.map((result, index) => (
            <button key={`${result.place_id}-${index}`} type="button" role="option" aria-selected={false} onClick={() => void handleResultSelect(result)} className="flex min-h-11 w-full items-start gap-2 border-b border-border/50 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-sitva-blue" />
              <span className="min-w-0 text-sm"><span className="block truncate font-semibold">{result.display_name.split(',')[0]}</span><span className="block truncate text-xs text-slate-500">{result.display_name.split(',').slice(1).join(',').trim()}</span></span>
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" className="min-h-5 text-sm text-slate-500">
        {isBusy ? 'Buscando ubicación…' : ''}
      </div>

      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Opciones de viaje</summary>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-foreground">
          <input type="checkbox" checked={busesEnabled} onChange={(event) => onBusesEnabledChange(event.target.checked)} className="h-5 w-5 accent-sitva-blue" />
          Incluir buses articulados
        </label>
      </details>

      <button type="button" disabled={!canSubmit || isBusy} onClick={onSubmit} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sitva-blue px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
        Ver rutas
      </button>
    </section>
  );
}
