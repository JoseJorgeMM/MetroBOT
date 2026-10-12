# Clasificación tarifaria mediante evidencia de estaciones

## Objetivo

Reconocer un tramo que Google entrega como `BUS` como Metroplús cuando el catálogo oficial de estaciones aporta evidencia suficiente, para calcular las integraciones del SITVA sin inventar tarifas para buses convencionales.

## Decisión

El adaptador tarifario evaluará los tramos `bus` y `bus_articulado` con estos requisitos acumulativos:

1. La agencia debe ser Metro de Medellín o Empresa de Transporte Masivo del Valle de Aburrá.
2. La parada de subida y la de bajada deben corresponder de manera inequívoca a estaciones `MPLUS` del catálogo: nombre normalizado compatible y coordenadas a menos de 300 m.
3. Las dos estaciones deben compartir la misma línea oficial de Metroplús.

El nombre de línea de Google se conserva como información de viaje, pero no se usa como equivalencia de la línea tarifaria: puede contener un recorrido, por ejemplo `Ruta N - U de A`.

Cuando se cumplen los tres requisitos, el segmento se clasifica como `METROPLUS`, el paso visible pasa a `metroplus` y el motor existente usa su regla explícita `METROPLUS → METRO`. Los horarios de Google continúan siendo horarios previstos, por lo que el total se etiqueta como condicional; no se finge una validación Cívica.

Si cualquier requisito falta, el tramo sigue siendo bus no determinado. No se hará coincidencia sólo por cercanía, sólo por agencia ni por palabras del nombre.

## Verificación

Las pruebas deben cubrir el caso Ruta N/Cisneros con rótulos extendidos de Google, una agencia o paradas no verificadas que permanezcan sin tarifa, y la tarifa total Metroplús → Metro según el grupo oficial existente.
