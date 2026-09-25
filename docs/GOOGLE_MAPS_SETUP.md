# Configuración de Google Maps y transporte público

Fuentes oficiales consultadas el 25 de septiembre de 2026. Guía del diseño aprobado: Google Routes como proveedor principal, endpoint en Vercel y alternativa local identificada. Las pruebas autenticadas requieren el código integrado y las credenciales del despliegue.

## Proyecto y claves

Vincula el proyecto Google Cloud a una cuenta con facturación habilitada. Activa **Routes API** y **Maps JavaScript API**. Se mantienen las búsquedas OpenStreetMap/Nominatim existentes: no se requiere Places API. Consulta [uso y facturación de Routes](https://developers.google.com/maps/documentation/routes/usage-and-billing).

| Variable | Ubicación | Restricciones |
| --- | --- | --- |
| `GOOGLE_ROUTES_API_KEY` | Servidor, Vercel **Secret/Sensitive** | Únicamente **Routes API**. Nunca enviarla al navegador. |
| `VITE_GOOGLE_MAPS_API_KEY` | Navegador, Vercel **Config** pública | Sitios web / HTTP referrers y únicamente **Maps JavaScript API**. |

Autoriza en la clave pública el dominio de producción y los dominios concretos de Preview que uses, con sus rutas (`https://tu-dominio.example/*`). Para desarrollo, añade `http://localhost:3000/*` si ese es tu origen. Evita autorizar todos los sitios de `vercel.app`. El prefijo `VITE_` expone el valor al cliente; no lo convierte en secreto ocultarlo en el panel.

Google recomienda restringir por IP de salida las claves del servidor cuando sea viable. La salida dinámica de Vercel dificulta una lista estable: no uses la IP del dominio del sitio ni referrers para autenticar la función. Si necesitas esa restricción, configura y verifica una salida estática compatible. Conserva siempre la restricción de API; guardar la clave como secreto no protege por sí solo un endpoint público contra abuso. Revisa la [seguridad de Google Maps](https://developers.google.com/maps/api-security-best-practices) y la [conectividad de Vercel Functions](https://vercel.com/docs/functions). No registres claves ni cuerpos completos de viajes en logs.

Vercel confirma el uso de IP de salida dinámicas por defecto y explica las opciones de salida estable en su [guía oficial de listas de IP permitidas](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address).

## Variables y ejecución

Usa `.env.example` como referencia para `.env.local`, ignorado por Git. Las dos claves Google y CARTO están vacías en el ejemplo. Introduce los valores únicamente en el entorno privado; no los pegues en documentación, capturas ni commits.

En Vercel → proyecto → Settings → Environment Variables, crea las variables con la clasificación anterior y asígnalas a **Production y Preview**. Añade Development si lo necesitas. **Vuelve a desplegar** al cambiarlas: la clave pública se incorpora al build y la privada debe llegar a la función del nuevo despliegue. Fuente: [variables de entorno de Vercel](https://vercel.com/docs/environment-variables).

`GOOGLE_TRANSIT_ENABLED=false` es un interruptor opcional del servidor para desactivar consultas de transporte Google; el valor predeterminado es `true` si se omite. Aun así se necesitan claves válidas. Reinicia el servidor local o vuelve a desplegar al cambiarlo. No es un límite de facturación de la cuenta ni necesariamente desactiva otras cargas de mapas.

El flujo local previsto usa `npm run dev`: el middleware de Vite comparte el manejador de API de Vercel (`/api/transit-routes`). `npm run preview` sirve solo el build estático: **no ejecuta la API** ni valida el flujo completo. Comprueba que el middleware esté integrado antes de probar con claves.

## Uso gratuito y control de gasto

La [tabla oficial de precios](https://developers.google.com/maps/billing-and-pricing/pricing) muestra actualmente **10.000 eventos gratuitos al mes por SKU** para **Routes: Compute Routes Essentials** y **Dynamic Maps**, respectivamente. El consumo se agrega entre proyectos vinculados a la cuenta de facturación: no hay una franquicia nueva por clave, usuario o despliegue. Calcular rutas y cargar mapas son eventos diferentes. Se necesita facturación habilitada; no es ilimitado y los excesos pueden generar cargos. Verifica el SKU real: campos u opciones adicionales pueden cambiar la clasificación.

Configura cuotas diarias conservadoras **donde estén disponibles**, límites de frecuencia y protección contra abuso. Comprueba las cuotas reales de cada API en Cloud Console; no todas ofrecen los mismos límites editables. Los presupuestos y alertas **NO son topes duros** ni bloquean automáticamente el gasto. Cuotas y facturación pueden diferir; deja margen. Fuente: [gestión oficial de costes](https://developers.google.com/maps/billing-and-pricing/manage-costs).

Un presupuesto mensual estricto requiere un control de consumo a nivel de cuenta que contemple todos los proyectos y entornos, y corte solicitudes y cargas antes de agotar el margen. Un contador en memoria de una función o una alerta no basta. Ese control debe implementarse y verificarse aparte; esta guía no lo instala. Si una API no ofrece cuotas aplicables o no puedes controlar todos sus eventos, **no puedes garantizar cero cargos** manteniéndola activa.

## Resultados y fallos

Se usa `computeRoutes` con `travelMode: TRANSIT`, origen, destino y campos necesarios. Los horarios, disponibilidad y tarifas dependen del proveedor; una tarifa ausente se presenta como desconocida. No se garantizan resultados idénticos a la aplicación Google Maps de consumo. Consulta [rutas de transporte público](https://developers.google.com/maps/documentation/routes/transit-route).

La interfaz debe distinguir **Google Maps** de **ruta local estimada**. Ante falta de configuración, desactivación, cuota agotada, error, timeout o ausencia de resultados de Google, debe explicar la causa disponible y etiquetar la alternativa local. Un error de Google no prueba que no exista transporte. Si tampoco hay ruta local, indica su cobertura limitada; no lo atribuyas a Google.

La alternativa usa el enrutador y los datos locales existentes: tiene cobertura limitada, no ofrece información en tiempo real ni todas las combinaciones del SITVA. Un fallo al cargar el mapa Google debe identificarse como tal; nunca debe resolverse dibujando su geometría sobre otro proveedor.

## Mapas, privacidad y avisos

Muestra geometrías y resultados cartográficos Google **solo sobre Google Maps**, conservando atribuciones. No los dibujes sobre Leaflet/OSM/CARTO. El diseño no debe guardar respuestas, geometrías ni detalles de Routes en bases de datos, localStorage, caché HTTP o service worker; excluye también recursos Google del caché propio. Se pueden mantener las preferencias locales de la aplicación. Fuente: [políticas de Routes y atribución](https://developers.google.com/maps/documentation/routes/policies).

Publica y enlaza `/terms.html` y `/privacy.html`. Describen origen/destino enviados a Google a través de Vercel, almacenamiento local, búsquedas OSM y el asistente opcional Gemini que actualmente consulta desde el cliente. La clave Routes no debe seguir el patrón actual de Gemini, cuyas variables se incorporan al cliente.

**Antes de producción**, el responsable del despliegue debe revisar los avisos, completar identidad y contacto reales, definir conservación y verificar logs y proveedores. Los textos no certifican cumplimiento legal ni ausencia de retención por terceros.

## Comprobación de aceptación

- Probar una ruta conocida en `npm run dev` y Vercel Preview con credenciales válidas: proveedor Google, mapa y atribución visibles.
- Confirmar que la clave privada no aparece en solicitudes o respuestas del navegador; la pública sí será visible por diseño.
- Probar desactivación, error, resultado vacío y fallo del mapa: motivo correcto, alternativa local etiquetada, sin promesas de tiempo real.
- Revisar SKU, consumo agregado, restricciones y cuotas en Cloud Console, incluidas las cargas de mapas y todos los entornos.
- Verificar que no se persisten respuestas Google y que ambos avisos públicos abren, enlazan a Google y permiten volver a `/`.

Esta documentación no confirma por sí sola que esas pruebas hayan pasado.
