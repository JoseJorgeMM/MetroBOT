/// <reference types="vite/client" />

// Ambient declarations for libraries used without bundled TypeScript types.
declare namespace google {
  namespace maps {
    namespace places {
      class AutocompleteService {
        getPlacePredictions(req: any, cb: (p: any) => void): void;
      }
      class PlacesService {
        constructor(node: HTMLElement);
        getDetails(req: { placeId: string | number }, cb: (place: any, status: string) => void): void;
      }
      class AutocompletePrediction {
        place_id: string;
        description: string;
      }
      const PlacesServiceStatus: { OK: string };
    }
    class LatLng {
      constructor(lat: number, lng: number);
    }
  }
}

declare const google: any;

interface Window {
  google?: any;
  leafletMap?: any;
}
