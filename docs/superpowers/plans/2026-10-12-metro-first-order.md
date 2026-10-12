# Metro-first route ordering Implementation Plan

**Goal:** Aplicar el orden aprobado sin perder la prioridad seleccionada ni la identidad del recorrido.
**Architecture:** Clasificar medios con classifyRouteSegments y evidencia existente; ordenar por grupo y luego por el comparador actual. No usar precio desconocido, nombres ni proveedor como identidad del transporte. Conservar índices originales para mapa y selección.
**Tech Stack:** TypeScript, React 19, node:test/tsx.

Diseño aprobado: Metro/Metrocable/Tranvía/Metroplús antes de alimentadores e integrados; buses convencionales o no identificados al final. Caminar y EnCicla no degradan una combinación Metro; si son la única modalidad se muestran en un grupo propio antes de buses. Cualquier tramo de bus desconocido lleva la combinación completa al último grupo. No modificar tarifas, candidatos del proveedor ni restricciones/recomendaciones personalizadas.

- [x] Pruebas RED en tests/routeComparison.test.ts: ruta metro lenta precede bus rápido; prioridades duration/cost/walking/transfers ordenan dentro del grupo; alimentadores e integrados diferenciados; Metroplús estructurado no se degrada; desconocidos conservadores; precio/proveedor no clasifican; índices y entradas intactos.
- [x] Implementar en src/lib/routeComparison.ts getRouteSystemGroup(route,evidence), etiquetas de grupo y rankRoutes(routes,priority,evidence={}) con claves `grupo,score,duración,índice` calculadas una vez por ruta.
- [x] Integrar evidence en RouteComparison; explicar orden fijo y criterio interno, encabezados por grupo sin reordenar el array original ni cambiar selección existente. Reutilizar clasificación y datos ya cargados, sin nuevas peticiones.
- [x] GREEN pruebas focalizadas y regresión completa; npm run lint y npm run build. Revisar diff y comprobar UI si el entorno permite reproducir candidatos mixtos. No push/deploy ni commit de cambios previos.

Verificación: RED observado en 4 pruebas de orden y 1 UI; GREEN 280/280 pruebas, tsc sin errores, build correcto. Aviso previo de bundle >500 kB permanece. No se modificaron tarifas, datos públicos ni la selección activa. Clasificación conservadora basada en todos los tramos.

