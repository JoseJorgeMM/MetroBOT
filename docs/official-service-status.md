# Estado operativo oficial del Metro

## Qué está conectado

MetroBOT consulta desde `/api/metro-status` el JSON que utiliza el semáforo de la web oficial:

https://www.metrodemedellin.gov.co/_hcms/api/semaforos

La conexión no requiere una API key ni Gemini. El navegador no envía ubicaciones, rutas ni datos del usuario al Metro: el backend consulta una URL fija y devuelve el estado de las líneas A, B, H, J, K, L, M, P, T, O, 1 y 2.

Es un endpoint público del sitio web, **no una API contractual con disponibilidad garantizada**. Antes de un despliegue institucional, acordar reutilización y continuidad con el Metro. Que hoy no exija una clave no garantiza gratuidad perpetua. Las cuotas/costos de alojamiento de Vercel siguen aplicando.

## Evidencia y límites

- `checkedAt`: momento en que el backend obtuvo la respuesta; no es la hora de publicación del Metro.
- `expiresAt`: cinco minutos después de esa consulta. El navegador rechaza respuestas vencidas, incluidas respuestas antiguas del CDN.
- `sourceUpdatedAt: null`: el origen no proporciona fecha de actualización. No podemos garantizar cuán reciente es el reporte del Metro.
- Estados y textos provienen del semáforo; no hay interpretación por IA de noticias o redes sociales.
- El feed no identifica estaciones afectadas. Ni un aviso de línea confirma el cierre de todas sus estaciones ni un estado normal garantiza el funcionamiento de accesos/ascensores.
- Los avisos son actuales, no predicciones para el horario del itinerario. No eliminan ni reordenan las rutas.
- Instagram es únicamente un enlace al perfil oficial, no una extracción automática de publicaciones o historias.

## Funcionamiento

1. Vercel ejecuta `api/metro-status.ts`, usando el mismo handler probado en desarrollo/preview de Vite.
2. Se valida el JSON, se conservan los textos oficiales, y las líneas ausentes/duplicadas o desconocidas quedan sin verificar.
3. El CDN de Vercel puede compartir la respuesta durante 300 segundos, sin stale-while-revalidate. El navegador no la guarda en caché HTTP ni en almacenamiento persistente. No se depende de memoria de una función para caché compartida.
4. El cliente comparte las consultas concurrentes y reutiliza el resultado solo hasta su `expiresAt`, no otros cinco minutos desde que lo recibió. Las consultas ocurren bajo demanda mientras hay paneles montados, no como tarea programada cuando nadie usa la app.
5. Al fallar el origen, devuelve HTTP 503 y todas las líneas sin verificar. Se reintenta desde la interfaz tras 30 segundos. El timeout del origen es 8 segundos; límite de respuesta 64 KB. No se devuelve el último estado normal como si siguiera confirmado.

## Dónde se muestra

- Inicio: resumen de novedades y detalle desplegable de las doce líneas.
- Tarjetas de rutas: solo líneas compatibles con el sistema identificado. Un bus con número 1/2/O necesita identidad de Metroplús u operador exacto Metro de Medellín. Los buses externos y las líneas ambiguas se marcan fuera de cobertura.
- Asistente anterior: reutiliza la misma fuente, sin Google Search/Gemini para decidir el estado. Consultas de estaciones individuales responden que no hay verificación por estación.

## Activación y verificación

No se necesita modificar `.env.local` ni registrar credenciales. Reiniciar Vite si no ha recargado su configuración. En Vercel es necesario publicar estos cambios; este trabajo no los despliega automáticamente.

```powershell
npm run dev
Invoke-RestMethod http://localhost:3000/api/metro-status
node --import tsx --test tests/serviceStatus.test.ts tests/serviceStatusPanel.test.tsx tests/serviceStatusHook.test.tsx tests/legacyServiceStatus.test.ts
npm run lint
npm run build
```

El GET debe devolver `availability: available` y doce líneas si el origen responde. Un 503 con `unavailable` es degradación explícita, no un reporte de cierres. La interfaz enlaza siempre al sitio oficial para confirmar antes de viajar.
