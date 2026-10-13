# Professional Map and Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar únicamente lugares pertinentes del Valle de Aburrá, reducir el ruido visual del mapa y hacer transparente la calidad de los datos de estación.

**Architecture:** Un módulo puro define el perímetro de búsqueda y filtra resultados. El mapa mantiene una selección local de sistemas visibles que se combina con el filtro de navegación. La ficha de estación hereda tokens de tema y presenta una declaración de procedencia sin datos operativos ficticios.

**Tech Stack:** React 19, TypeScript, react-leaflet, node:test, Tailwind.

---

### Task 1: Relevancia geográfica del planificador

**Files:**
- Create: `src/lib/metroArea.ts`
- Modify: `src/components/TripPlannerPanel.tsx`
- Test: `tests/metroArea.test.ts`

- [x] Escribir pruebas para aceptar Estadio y La Estrella dentro del Valle de Aburrá y rechazar El Campín/Bogotá y coordenadas inválidas.
- [x] Ejecutar `node --import tsx --test tests/metroArea.test.ts` y confirmar el fallo por ausencia del módulo.
- [x] Implementar `isWithinMetroArea` con límites explícitos y filtrar resultados Nominatim, solicitar `locationRestriction` a Google Places y rechazar detalles fuera del perímetro.
- [x] Ejecutar de nuevo la prueba focalizada y verificar que pasa.

### Task 2: Capas de red legibles

**Files:**
- Create: `src/lib/mapLayers.ts`
- Modify: `src/components/Map/MapComponent.tsx`
- Test: `tests/mapLayers.test.ts`

- [x] Escribir pruebas que fijen la red masiva como visibilidad inicial, oculten EnCicla inicialmente y mantengan todos los sistemas de una ruta activa.
- [x] Ejecutar `node --import tsx --test tests/mapLayers.test.ts` y confirmar el fallo inicial.
- [x] Implementar filtros puros y un control de capas accesible que no cambie el catálogo ni el recorrido.
- [x] Ejecutar las pruebas focalizadas y comprobar que pasan.

### Task 3: Ficha confiable y coherente

**Files:**
- Modify: `src/components/Map/StationDetails.tsx`, `src/components/Map/StationDialog.tsx`
- Test: `tests/stationDetails.test.tsx`

- [x] Escribir una prueba de render que exija tokens `bg-card`/`text-foreground` y una declaración explícita de catálogo sin operación en vivo.
- [x] Ejecutar la prueba y confirmar el fallo contra la ficha blanca actual.
- [x] Sustituir colores fijos por tokens de tema y añadir el bloque de procedencia.
- [x] Ejecutar la prueba focalizada y confirmar que pasa.

### Task 4: Verificación integrada

**Files:**
- Modify: `tests/tripPlanner.test.tsx`
- Modify: `docs/superpowers/specs/2026-10-12-professional-map-and-planner-design.md`

- [x] Comprobar el texto de transparencia del planificador y que no prometa información en vivo.
- [x] Ejecutar `npm run lint`, `node --import tsx --test tests/*.test.ts tests/*.test.tsx`, `npm run build` y probar en navegador: inicio → planificador → búsqueda → ficha de estación.
- [x] Registrar evidencia y hacer commit de los cambios verificados.
