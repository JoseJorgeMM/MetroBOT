# Estado operativo verificado del Metro

## Objetivo

Mostrar novedades operativas recientes del Metro de Medellín usando Gemini con
Google Search Grounding, sin presentar ausencia de resultados como “operación
normal”.

## Diseño

La consulta de estado será independiente del cálculo de rutas. `gemini.ts`
creará una petición con `tools: [{ googleSearch: {} }]` y un prompt que exija
buscar la situación actual, priorizar fuentes oficiales del Metro y entregar
fecha/hora, líneas o estaciones afectadas, nivel de confianza y una respuesta
estructurada. La respuesta se parseará defensivamente y sus citas se extraerán
de `groundingMetadata`.

Las fuentes públicas de Instagram/Facebook pueden aparecer en los resultados de
Google y se mostrarán como evidencia secundaria. Una publicación social no
confirmará por sí sola el estado oficial; la interfaz marcará la consulta como
no verificada si no hay respaldo suficiente.

## Estados y seguridad

- `normal`: búsqueda reciente sin novedad operativa detectada.
- `alerta`: la respuesta identifica una falla, cierre o retraso.
- `no_verificado`: API caída, respuesta ambigua, sin citas o información vieja.

El estado inicial y cualquier error serán `no_verificado`, nunca `normal`.
Cada resultado mostrará hora de consulta y hasta tres fuentes con enlace.

## Alcance

Incluye consulta automática al abrir/actualizar el panel, caché en memoria de
cinco minutos, parser y pruebas de unidad, y reemplazo del fallback indirecto
de Google News para el panel de estado.

No incluye afirmaciones de telemetría de trenes, posiciones GPS de vehículos,
ni garantía de que Google Search indexe publicaciones privadas o recientes de
redes sociales.
