# Tarifas por cadena de viaje

La fuente es `src/costosintegraciones.json`, conservada sin modificaciones. Los valores reflejan esa configuración; no implican una consulta en vivo al operador.

## Correspondencia explícita

`src/lib/fares/config.ts` mantiene categorías internas distintas:

| Categoría interna | Grupo tarifario |
| --- | --- |
| integracion_1 | integraciones_1_4 |
| integracion_2 | integraciones_1_4 |
| integracion_3 | integraciones_5_7 |
| integracion_4 | integracion_8 |
| integracion_5 | integraciones_9_10 |

El motor compara la secuencia real de medios con las combinaciones del JSON, o con una transferencia direccional explícita; luego resuelve categoría, grupo y perfil. Nunca extrae números del nombre. Una correspondencia ausente produce `NO_DETERMINADA` y total `null` (la interfaz heredada usa `cost: -1`). No se agrega otra tarifa por vehículo al total integrado.

## Uso y condiciones

- El selector de perfil recalcula las alternativas sin solicitar ni modificar su geometría. El perfil inicial es frecuente con Cívica, declarado en `fareConfig.defaultProfile`.
- `calculateFare(segments, profile)` es puro. `priceRoute` adapta rutas locales y Google; el precio del proveedor queda como dato auxiliar en `providerFare`.
- Los tramos estructurados pueden aportar `fareInput`: `mode`, `validationTime`, `scheduledTime`, `paidArea`, `newJourney`, `zone`, `basin`. Solo deben provenir de información verificada; no de una respuesta generada por IA.
- La ventana se mide desde el primer pago: masivo hasta 90 minutos; colectivo menos de 90. Un horario previsto no prueba una validación: el precio se marca `CONDICIONAL`. Sin tiempos comparables no se presume integración. Metro → Cable dentro de zona paga exige evidencia explícita.
- Un BUS genérico no se clasifica por proximidad ni por su precio. Alimentadores C3/C6 requieren una coincidencia única en el catálogo. Los demás buses necesitan tipo tarifario, zona y, para doble integración, cuencas distintas. El catálogo actual no contiene todos esos datos.
- Arví requiere categoría propia; EnCicla y caminar no reinician la ventana. Un transbordo de cero se presenta como `$0 adicional`, no como viaje gratuito.
- El desglose atribuye importes a la cadena: no es un comprobante de validaciones reales. Si no hay importes para todos los prefijos, el total se atribuye al primer tramo y los siguientes quedan incluidos.
- Solo se muestra ahorro si existen todas las tarifas independientes necesarias para compararlo. Un tramo desconocido impide presentar una suma parcial como total.

## Mantenimiento

Para un nuevo tarifario, actualizar versión, vigencia y valores de grupos/perfiles en el JSON; las combinaciones existentes no necesitan reescribirse. Una nueva combinación necesita una regla y correspondencia explícitas. Los nuevos tipos de integración con condiciones diferentes requieren su implementación y pruebas: no se deducen automáticamente.

Diagnóstico optativo: `VITE_FARE_DEBUG=true` durante desarrollo. Los registros incluyen perfil, cadenas y motivos pendientes, no coordenadas; están desactivados en producción.

Pruebas: `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx`, `node --test tests/test_*.mjs`, `npm run lint`, `npm run build`.
