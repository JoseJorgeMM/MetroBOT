# Inteligencia de viaje de MetroBOT

## Qué aporta

«Diseña mi viaje» transforma una necesidad escrita en origen, destino y límites editables. Gemini interpreta el texto; no crea rutas, coordenadas, horarios ni tarifas. El usuario confirma lugares del catálogo o termina de buscarlos en el planificador existente.

Las rutas reales del planificador Google/local pasan por el motor tarifario existente y después por un evaluador determinista. Este compara presupuesto, tiempo, caminata y transbordos, explica por qué una alternativa cumple o no, y permite excluir un servicio entre las alternativas recibidas. También proyecta el gasto de repetir el mismo trayecto en un solo sentido. Cambiar las condiciones no consume otra llamada a Gemini.

No es un modelo predictivo entrenado, un monitor de interrupciones ni una garantía de accesibilidad. Condiciones adicionales sin datos verificables impiden recomendar hasta que el usuario las revise o retire expresamente. Una tarifa desconocida no se convierte en cero; las tarifas condicionales conservan su advertencia.

## Configuración

En el servidor local `.env.local` o en las variables del proyecto Vercel:

```dotenv
GEMINI_API_KEY=tu_clave_privada
GEMINI_MODEL=gemini-2.5-flash
```

No usar el prefijo `VITE_` para estas variables. La clave se usa únicamente en `/api/journey-intent`. Reiniciar el servidor local o crear un nuevo despliegue después de configurarlas. No se han cambiado claves ni publicado este desarrollo.

La integración Google Maps/Routes mantiene sus variables y servicios existentes; Gemini no los sustituye ni activa. Si Google no está disponible, el planificador utiliza su respaldo local y muestra la limitación. Si Gemini no está disponible, queda habilitada la edición manual y una extracción local básica, identificada como tal.

## Seguridad y límites

- Texto máximo de 1.200 caracteres; petición de hasta 8 KiB y respuesta del proveedor acotada.
- Contrato estricto de salida, límites numéricos, cancelación y tiempo máximo de 12 segundos.
- Solo POST JSON; rechazo de peticiones de navegador de otro origen; respuestas sin caché.
- Límite defensivo de 20 solicitudes/minuto por cliente e instancia. No es autenticación, un límite distribuido ni un tope de facturación. Para una exposición pública amplia, configurar cuotas y protección de abuso en el proveedor/hosting.
- Se envía el texto que el usuario decide interpretar; no se adjuntan automáticamente GPS ni historial. No se registra el texto ni se persiste un historial de prompts en esta función. Aplican las políticas del proveedor.

## Verificación y demostración

```powershell
npm run lint
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx
node --test tests/test_*.mjs
npm run build
```

Demostrar una pregunta de precio entre estaciones, elegir coincidencias explícitas y comparar. Después variar el presupuesto y excluir una línea; mostrar también el caso sin alternativas viables. No presentar la simulación como una interrupción real.

Para un piloto con Metro, medir mediante un protocolo consentido: porcentaje que logra planificar, tiempo hasta elegir, correcciones de lugares/intención y comprensión de tarifas desconocidas. Comparar con el planificador actual y reportar resultados observados, no porcentajes de mejora supuestos. No se añadió telemetría personal en este desarrollo.
