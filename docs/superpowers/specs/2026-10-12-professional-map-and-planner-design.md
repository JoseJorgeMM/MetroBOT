# Diseño: mapa y planificador profesionales

## Propósito

Hacer que MetroBOT ayude a elegir y entender viajes dentro del Valle de Aburrá con una interfaz clara, coherente y honesta sobre la procedencia de los datos.

## Alcance de la primera entrega

1. La búsqueda de lugares se restringe al Valle de Aburrá. Google Places recibe una restricción geográfica, Nominatim descarta resultados fuera del área y una selección externa se rechaza antes de calcular rutas.
2. El mapa deja de mostrar todas las capas de forma indiscriminada. Metro, Metroplús, Cable y Tranvía se muestran inicialmente; EnCicla se puede activar desde un selector de capas con conteos. En navegación sólo se conservan los puntos del recorrido.
3. La ficha de estación usa tokens de tema y un bloque de procedencia que diferencia catálogo estático de datos operativos no conectados. No se muestra estado, accesibilidad ni horarios como si fueran información en vivo.
4. El inicio y el planificador explican que la comparación usa rutas, costo estimado y condiciones verificables, no una promesa de tiempo real.

## Límites y seguridad

- El perímetro abarca municipios del Valle de Aburrá; se excluyen resultados fuera de esa zona aunque Google los sugiera.
- No se crean incidentes, tiempos de llegada, disponibilidad de EnCicla ni accesibilidad ficticia. Una futura integración oficial debe aportar fuente, fecha y cobertura antes de aparecer como estado operativo.
- Los filtros del mapa no modifican la ruta ni eliminan estaciones del catálogo: sólo controlan visibilidad.

## Experiencia

La persona busca un origen o destino, recibe resultados locales y ve un mapa que prioriza la red masiva. Puede habilitar EnCicla si le interesa. Al abrir una estación recibe una ficha visualmente coherente que aclara qué proviene del catálogo y qué información aún no está conectada.

## Verificación

Pruebas unitarias para perímetro y filtros; pruebas de interfaz para texto y controles; lint, suite completa, build y revisión del flujo local: inicio → planificador → sugerencias locales → ficha de estación.
