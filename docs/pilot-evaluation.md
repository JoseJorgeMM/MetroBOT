# MetroBOT Conexiones: evaluación local

Abre «Diseña mi viaje», encuentra Conexiones y entra en «Panel de evaluación del piloto». El panel también acompaña las rutas compatibles con la conexión San Antonio A → B hacia San Javier.

## Recoger e importar observaciones

1. Abre «Explorar conexión San Antonio». La asistencia muestra referencias documentales; no ofrece navegación interior ni estado operativo en vivo.
2. En «Evaluar esta experiencia», acepta participar. El contexto predeterminado es práctica y la fase está sin asignar.
3. Para un piloto presencial autorizado, el facilitador selecciona campo y referencia o asistida antes de registrar respuestas. Referencia significa sin usar la asistencia; asistida, después de usarla. Acordar condiciones comparables y consentimiento antes del estudio.
4. Registra categorías por momento y descarga el JSON v2. No contiene fotos, transcripciones, GPS ni identidad. Su ID identifica una sesión, no una persona.
5. Importa los archivos en el panel. Un archivo repetido no incrementa las cifras. Si un mismo ID tiene contenido diferente se rechaza; conserva una única exportación final por sesión. Los formatos v1 se rechazan porque no tienen procedencia ni fase.
6. Descarga el informe agregado antes de cerrar. No contiene IDs ni observaciones individuales. Cerrar el panel elimina su memoria local, no las copias que hayas descargado.

## Interpretación responsable

- Demostración usa únicamente datos sintéticos de `/transfers/pilot-demo.json`, nunca mezclados con importaciones.
- Campo es una declaración, no una verificación automática.
- Cada tasa usa sesiones que respondieron en ese momento. Ausencia de respuestas no equivale a 0%.
- Varias categorías pueden coexistir; no tienen que sumar 100%.
- Referencia/asistida excluye práctica y fase sin asignar. La comparación no prueba causalidad, demanda, congestión ni cantidad de personas únicas.
- La priorización por solicitudes de ayuda es una regla auditable, no un modelo predictivo. Gemini transcribe señales con consentimiento; las referencias se comprueban después de revisión humana.
- No es un servicio oficial del Metro. Para presentar resultados reales hace falta ejecutar y validar el protocolo de campo con la entidad, no sustituirlo por la demostración.

## Límites técnicos

20 archivos por lote, 128 KiB por archivo y 100 sesiones en memoria. Esquema cerrado v2, catálogo 1, piloto San Antonio. No requiere otra API key, base de datos ni telemetría. El reconocimiento visual mantiene la configuración Gemini existente y no se activa al abrir el panel.
