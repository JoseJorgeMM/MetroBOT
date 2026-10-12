# Station Evidence Fare Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clasificar con evidencia de catálogo los tramos Google BUS que son Metroplús y calcular su integración documentada.

**Architecture:** `routeAdapter` resuelve las paradas Google frente a estaciones MPLUS mediante nombre compatible y coordenadas, exige agencia y línea oficial comunes, y reutiliza el motor de tarifas existente. La ruta presentada refleja el modo clasificado sin cambiar pasos no verificados.

**Tech Stack:** TypeScript, React, node:test, catálogo CSV de estaciones Metro.

---

### Task 1: Regresión de Ruta N a Cisneros

**Files:**
- Modify: `tests/fareAdapter.test.ts`
- Modify: `src/lib/fares/routeAdapter.ts`

- [x] Escribir una prueba que cree un bus Google de `Ruta N - U de A` a `Cisneros - Moda`, con los rótulos de catálogo `Parada Ruta N` y `Parada Cisneros`, agencia Metro de Medellín, coordenadas de ambas paradas MPLUS, línea oficial 1 y un Metro posterior.
- [x] Ejecutar `node --import tsx --test tests/fareAdapter.test.ts` y verificar que falla porque el bus sigue no determinado.
- [x] Resolver las dos paradas con coincidencia nominal compatible y coordenadas, exigir agencia oficial y la misma línea de catálogo, y clasificar sólo entonces como `METROPLUS`.
- [x] Reflejar el modo clasificado en los pasos y modos devueltos por `priceRoute`, manteniendo la tarifa calculada por el motor existente.
- [x] Reejecutar la prueba focalizada y verificar que la cadena es `METROPLUS → METRO`, el total es condicional y usa el grupo explícito.

### Task 2: Límites de seguridad y verificación

**Files:**
- Modify: `tests/fareAdapter.test.ts`

- [x] Añadir un caso que omita la agencia oficial o una estación verificable y confirme que sigue `TIPO_TRANSPORTE_NO_DETERMINADO` y sin total.
- [x] Ejecutar `npm run lint`, `node --import tsx --test tests/*.test.ts tests/*.test.tsx` y `npm run build`.
