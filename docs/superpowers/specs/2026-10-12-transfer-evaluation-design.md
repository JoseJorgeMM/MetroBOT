# MetroBOT Conexiones: piloto medible aprobado

El usuario aprobó continuar con San Antonio y el panel de evaluación. Se conserva la asistencia documental y la lectura de señales de Gemini; no se habilita navegación interior ni se inventan datos operativos.

## Entrega
- Tarjeta de conexión con referencias verificadas, advertencia de zona paga y acceso al costo del viaje cuando exista contexto tarifario. Sin precio si se abre fuera de un recorrido.
- Evaluación voluntaria: categorías cerradas, sin fotos, texto libre, GPS, identidad ni transmisión. Diferenciar práctica de campo declarado y referencia de experiencia asistida. No inferir esas etiquetas.
- Panel local accesible desde Conexiones: importar archivos de sesión, rechazo de archivos incompatibles, deduplicación, modo demostración separado, indicadores por etapa con denominador explícito y comparación descriptiva referencia/asistida.
- Exportación agregada de resultados y protocolo para demostrar el piloto. No hay base de datos multiusuario ni publicación al Metro.

## Contrato v2
JSON de una sesión: schemaVersion:2, pilot:'san-antonio-a-b', sessionId UUID aleatorio efímero, catalogVersion:1, context:'practice'|'field', phase:'unassigned'|'baseline'|'assisted', observations:[{stage:'connection'|'sign',kind:'unclear'|'help-needed'|'useful'}]. Máximo seis pares únicos. El ID evita importar dos veces el mismo archivo; no identifica personas. Cerrar descarta la sesión salvo exportación explícita. La práctica es el valor predeterminado y queda excluida de comparaciones de campo.

## Interpretación
Cada indicador cuenta sesiones con una categoría / sesiones que respondieron en esa etapa. Una sesión puede elegir varias categorías: porcentajes no suman 100. Sin respuestas: no calculable, no cero. Comparar sólo campo declarado de misma versión; sin inferencia causal, usuarios únicos, demanda o congestión. La agrupación de categorías es determinista, no se presenta como IA. El modelo existente sólo transcribe señales y requiere revisión humana.

## Importación y límites
Máximo 20 archivos por lote, 128 KiB por archivo y 100 sesiones. Validación de estructura exacta, enums, UUID, versión, seis pares únicos, sin campos extra sensibles. Duplicados idénticos se omiten; mismo ID con contenido diferente se rechaza. Informes v1 se rechazan con explicación para evitar inventar procedencia/grupo. Sólo se conserva memoria de la pestaña; cerrar panel descarta importaciones. La demostración se carga de public y nunca se combina con sesiones importadas.

## Verificación
Pruebas de validación, duplicados, conflictos, denominadores, separación demo/campo, exportación sin datos personales, consentimiento y cierre. Pruebas React de importación/cambio de modo/exportación y validación visual local. Datos de ejemplo son sintéticos, nunca resultados de campo.
