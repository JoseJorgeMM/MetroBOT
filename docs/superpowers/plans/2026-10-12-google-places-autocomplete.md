# Google Places Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Preserve existing uncommitted work. Do not expose API keys, push, or deploy.

**Goal:** Usar Places API (New) para encontrar lugares antes del respaldo OpenStreetMap.

**Architecture:** El cargador añade la biblioteca Places; el planificador realiza Autocomplete (New) con token de sesión y resuelve la ubicación seleccionada mediante `Place.fetchFields`. Nominatim queda como fallback seguro.

**Tech Stack:** Vite, React 19, TypeScript, Google Maps JavaScript API, Places API, Places API (New), node:test, happy-dom.

### Task 1: Contrato de carga

**Files:**
- Modify: `tests/googleMapsScript.test.ts`
- Modify: `src/lib/googleMapsLoader.ts`

- [x] Escribir una expectativa RED de que el URL del script incluya `libraries: 'places'` y que la carga siga siendo asíncrona.
- [x] Ejecutar `node --import tsx --test tests/googleMapsScript.test.ts`; debe fallar porque Places no está declarado.
- [x] Añadir el parámetro `libraries: 'places'` al `URLSearchParams` de la carga única, sin crear una segunda clave ni segundo script.
- [x] Reejecutar la prueba y comprobar GREEN.

### Task 2: Búsqueda y selección Places (New)

**Files:**
- Modify: `tests/tripPlannerLifecycle.test.tsx`
- Modify: `src/components/TripPlannerPanel.tsx`
- Modify: `src/components/plannerState.ts`
- Modify: `src/global.d.ts`

- [x] Escribir RED: mockear `importLibrary`, `AutocompleteSuggestion.fetchAutocompleteSuggestions`, `toPlace` y `fetchFields`; esperar sugerencias Google, los campos mínimos y coordenadas al seleccionar.
- [x] Ejecutar la prueba focalizada y confirmar que falla por usar el servicio legado.
- [x] Implementar una caché por montaje para `loadGoogleMaps().then(importLibrary('places'))`, token por campo, resultado temporal asociado a la sugerencia y reinicio de token tras elegir.
- [x] Usar `{input, includedRegionCodes:['co'], language:'es', region:'co', locationBias:{center:{lat:6.2442,lng:-75.5812},radius:50000}}`; pedir sólo `displayName`, `formattedAddress`, `location` al seleccionar.
- [x] Reejecutar las pruebas focalizadas y de ciclo de vida.

### Task 3: Integración y verificación

**Files:**
- Modify: `tests/tripPlanner.test.tsx` si se requiere contrato de UI

- [x] Confirmar que Nominatim se conserva ante error/resultado vacío de Google y que resultados o detalles obsoletos no publican estado.
- [x] Ejecutar `npm run lint`, `node --import tsx --test tests/*.test.ts tests/*.test.tsx` y `npm run build` en serie.
- [ ] Abrir localhost, buscar un lugar; comprobar resultados Google si la clave local existe o respaldo sin error si no. No transmitir ni revelar claves.
