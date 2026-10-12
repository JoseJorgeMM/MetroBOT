# Google Places Autocomplete (New)

## Objetivo

El buscador de origen y destino debe usar Places API (New) cuando exista una clave configurada y el servicio esté disponible; Nominatim continúa como respaldo si Google no puede cargarse, no devuelve resultados o falla.

## Diseño

`googleMapsLoader` cargará Maps JavaScript con la biblioteca `places`. El planificador solicitará la biblioteca de Places de forma diferida al comenzar una búsqueda, para no bloquear la pantalla ni cargar Places si el usuario no busca.

La búsqueda usará `AutocompleteSuggestion.fetchAutocompleteSuggestions` con región Colombia, idioma español, sesgo hacia Medellín y un token por sesión de cada campo. Al elegir una sugerencia se convertirá en `Place`, se pedirán sólo `displayName`, `formattedAddress` y `location`, y se descartará el token. No se almacenan resultados de Google ni se registra texto de búsqueda.

Una sugerencia de Google conservará la predicción en memoria sólo hasta que el usuario la elija. Las respuestas vencidas, el desmontaje y cambios de campo no pueden actualizar el estado. Si Google falla, se usa el flujo Nominatim existente; no se muestra un error técnico al usuario ni se mezclan resultados de proveedores.

## Configuración requerida

La clave web pública debe tener Maps JavaScript API, Places API y Places API (New), facturación activa y referentes HTTP para Vercel y desarrollo local. Si no se cumplen, el respaldo permanece operativo.

## Verificación

Pruebas comprobarán que el cargador solicita Places, que el resultado Google usa Autocomplete (New), que selección obtiene sólo los campos requeridos, que se descarta el token y que el respaldo sigue funcionando. Se validarán tipos, build y el flujo de UI local sin revelar claves.
