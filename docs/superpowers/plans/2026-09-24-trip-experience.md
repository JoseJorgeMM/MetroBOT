# Experiencia de decisión de viaje

Alcance autorizado: mejorar funcionalidad y diseño sobre el sistema visual existente. Se conserva el mapa y el planificador; se añaden herramientas de comparación basadas en las rutas calculadas. No se afirma integración con Google ni datos operativos en vivo.

## Diseño

Resultados: encabezado con trayecto y acción para editar, selector de prioridad con cuatro criterios, tarjetas ordenadas conservando el índice original para seleccionar correctamente el mapa. Resumen de diferencias respecto a la alternativa más rápida. Pasos en un desplegable nativo, cifras estimadas explícitas y costes desconocidos sin convertirlos en gratuitos.

Inicio: identidad MetroBOT, introducción orientada al viaje y clima con fuente. La lluvia sugiere revisar caminatas, no interrupciones no confirmadas.

## Implementación

- [x] Probar clasificación estable, valores desconocidos y no mutación en tests de comportamiento.
- [x] Crear `src/lib/routeComparison.ts` y `src/components/RouteComparison.tsx`.
- [x] Integrar comparación en App sin modificar el orden almacenado ni los índices del mapa.
- [x] Refinar RouteCard e inicio dentro de los tokens existentes.
- [x] Validar tests y navegador en escritorio y móvil.

Hallazgo en navegador: una consulta real permaneció calculando durante varios minutos. Se añadió un límite de espera de 45 segundos, conservación de coordenadas y descarte de callbacks tardíos. El límite libera la interfaz; no cancela las peticiones de red del SDK. La finalización de una ruta real no quedó confirmada durante esta prueba.

Revisión visual: escritorio 1440×900 y móvil 390×844, con navegador integrado. Se revisaron jerarquía, textos, contraste oscuro, espaciado, controles y distribución del panel. Se reutilizó el diseño existente sin concepto raster nuevo. Se corrigió el espacio vacío del panel de escritorio. No se afirma fidelidad a un concepto aprobado ni verificación completa de datos externos.

## Límites

Las comparaciones no certifican tarifas ni horarios. Solo usan las estimaciones de rutas devueltas. No hay nueva API de Google habilitada en este trabajo. No publicar cambios hasta que el usuario lo solicite.
