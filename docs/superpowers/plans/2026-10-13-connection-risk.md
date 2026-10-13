# Propuesta de valor y evaluación de conexiones

Alcance autorizado: mensaje inicial claro y módulo de fragilidad de transbordos.

Diseño: función pura que recorre pares consecutivos de transporte y suma los tramos a pie intermedios. Margen = salida siguiente menos llegada anterior menos caminata. Horarios incompletos, incoherentes o trayectos intermedios no peatonales producen evaluación parcial. Umbrales orientativos de MetroBOT: margen menor de 3 min requiere revisión; caminata desde 10 min merece atención. No son probabilidades ni reglas oficiales del Metro. Un escenario de retraso local editable permite comparar margen original y ajustado sin modificar rutas, tarifas ni preferencias de ordenamiento. Accesibilidad e interrupciones quedan explícitamente sin verificar.

Implementación:
- Motor `src/lib/journey/connectionRisk.ts` y pruebas: márgenes, retrasos, medianoche, tiempos ausentes, caminata inválida, trayectos activos y ausencia de transbordos.
- Panel `src/components/RouteCards/ConnectionRiskPanel.tsx` en las tarjetas de ruta, con detalles por conexión y escenario editable; sin llamadas externas.
- Mensaje inicial: comparar costo integrado, caminata y margen de transbordos; botón “Viajar con mis preferencias”.
- Validación: pruebas de motor y renderizado, pruebas existentes, TypeScript y build. Revisión de la interfaz local cuando esté disponible.

Límites: evaluación orientativa basada en el itinerario. Las duraciones de caminata del proveedor están redondeadas. El retraso se aplica por separado a la llegada de cada conexión, no como predicción de propagación. No se predicen cierres ni accesibilidad.

Verificación de implementación: 296 pruebas correctas, incluida interacción del selector de retraso; TypeScript y build correctos. El build conserva el aviso previo de tamaño de bundle. La revisión visual no pudo completarse: la pestaña del navegador integrado quedó en una página de conexión rechazada y bloqueó la navegación posterior, incluso después de iniciar Vite en el puerto 4175. No se afirma validación visual ni despliegue.
