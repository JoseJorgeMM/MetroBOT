# MetroBOT Conexiones — piloto documental

## Alcance entregado

El acceso está en «Diseña mi viaje» y, cuando la ruta seleccionada contiene paradas estructuradas suficientes, en el comparador para San Antonio A → B hacia San Javier. Es un piloto independiente de comprobación de referencias, no navegación interior certificada ni un producto del Metro.

La persona puede elegir una foto, revisar la vista previa y autorizar su envío a Gemini. El navegador la recodifica a JPEG (máximo lado 1280 px) sin conservar metadatos originales. El modelo transcribe texto; una persona lo revisa y un comparador determinista evalúa referencias a B y San Javier. Texto ambiguo, otras líneas o destinos y vocabulario no reconocido producen abstención. Una referencia compatible no confirma ubicación, flecha, andén ni autorización para abordar. El modo manual no usa IA ni transmite el texto.

Se reutilizan `GEMINI_API_KEY` (privada) y `GEMINI_MODEL` del servidor; no se requiere una clave pública adicional. La ruta es `/api/transfer-sign`, con el mismo contrato en Vite y Vercel. Los límites por instancia no reemplazan protección distribuida ni cuotas del proveedor.

## Investigación realizada el 3 de octubre de 2026

- [Línea B oficial](https://www.metrodemedellin.gov.co/usuarios/sistema-integrado/linea-b): terminales, estaciones y transferencia. El listado incluye Estadio. No se extraen horarios para este piloto.
- [Línea A oficial](https://www.metrodemedellin.gov.co/usuarios/sistema-integrado/linea-a): contexto de red y San Antonio.
- [Renovación de escaleras, 22 de julio de 2026](https://www.metrodemedellin.gov.co/al-dia/noticias/las-estaciones-san-antonio-y-san-javier-estrenaran-escaleras-electricas-para-mejorar-la-experiencia-de-viaje): anuncia cambios de infraestructura y cerramientos temporales. No prueba que exista un cierre hoy.
- [Reto de movilidad San Antonio B](https://www.metrodemedellin.gov.co/reto-movilidad-en-san-antonio-b): documenta dificultades de circulación y antecedentes de plataformas; no es una medición de congestión actual.

No se localizó un plano interior actualizado con trazado peatonal y señales verificadas suficiente para dar giros o indicar ascensores. No se extrapolaron recorridos desde fotos generales ni de publicaciones antiguas. No se copiaron fotografías de terceros ni se entrenó un modelo con ellas. El catálogo público `public/transfers/san-antonio-a-b.json` guarda paráfrasis cortas, fuentes y límites, y se obtiene en tiempo de ejecución.

## Evaluación sin seguimiento

Participación voluntaria, categorías locales por momento (conexión/señal), sin foto, texto libre, GPS, identidad o transmisión automática. Cada combinación de momento y categoría se cuenta una vez por sesión. El archivo descargable contiene observaciones y un resumen, no personas únicas ni una estimación de demanda. Cerrar el piloto descarta la sesión. No hay todavía un panel de analítica multiusuario ni agrupación de reportes por IA: necesita un piloto consentido y datos reales.

## Siguiente nivel de validación

Para habilitar navegación interior harán falta rutas peatonales y puntos de decisión validados, gestión de vigencia/cambios y revisión con el operador. La estructura deja deshabilitada esa capacidad. No basta con poner `indoorNavigation=true`: el validador lo rechaza deliberadamente.

Para evaluar reconocimiento visual usar fotos de señalización autorizadas y etiquetadas, distintas de las usadas para desarrollo. Medir errores de lectura, abstenciones y referencias incorrectamente aceptadas. Las pruebas con imágenes sintéticas solo comprueban integración técnica, no precisión en la estación. La seguridad requiere que la herramienta se abstenga y remita al personal ante dudas.

## Verificación técnica — 8 de octubre de 2026

- `npm run lint`: comprobación TypeScript sin errores.
- `node --import tsx --test tests/*.test.ts tests/*.test.tsx`: 246 pruebas; incluye cancelación, respuestas tardías, procedencia de transcripciones editadas y exportación sin contenido sensible.
- `node --test tests/test_*.mjs`: 18 archivos de regresiones satisfactorios.
- `npm run build`: compilación y generación de service worker satisfactorias; permanece el aviso de Vite por el paquete principal de más de 500 kB.
- Navegador integrado en `http://127.0.0.1:4175/`, tamaño normal aproximado 877 × 708 y móvil 390 × 844: aplicación visible sin overlay ni errores de consola en el flujo comprobado. Abrir «Diseña mi viaje» → «Explorar conexión San Antonio» → texto compatible/conflictivo → participación local → cerrar/reabrir descarta la sesión.
- Imagen sintética creada exclusivamente para QA, no una fotografía real del Metro: carga, recodificación, consentimiento, petición real a Gemini, transcripción «Linea B / San Javier», revisión humana y resultado compatible comprobados desde el navegador.
- La primera llamada agotó los 12 segundos. Una comprobación directa mostró respuesta válida en unos 25 segundos. Se deshabilitó el razonamiento dinámico únicamente para el modelo predeterminado `gemini-2.5-flash`, según la [documentación oficial](https://ai.google.dev/gemini-api/docs/generate-content/thinking). Después, la API del piloto respondió 200 y el flujo de imagen funcionó en navegador. No constituye una garantía de latencia: se mantienen cancelación, límite de espera y modo manual.
- La automatización del navegador se bloqueó durante una comprobación posterior de edición/exportación; no se confirmó el archivo descargado ni la restauración del viewport. La procedencia del texto y el contenido exacto del Blob exportado están cubiertos por pruebas React montadas. No se afirma QA exhaustiva de descargas.

Sin despliegue ni cambios en tarifas o en `public/rutas_integradas.json`. No se han evaluado fotos de campo, accesibilidad con lectores de pantalla, múltiples navegadores ni precisión visual bajo iluminación real. Antes de exposición pública deben revisarse cuotas del proveedor y protección distribuida frente al abuso; el límite en memoria no es un tope global de gasto. No hay navegación interior, analítica multiusuario ni mediciones de impacto todavía.
