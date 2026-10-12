# Totales de viaje trazables

## Diseño autorizado
El usuario autoriza resolver los costos reales sin inventar tarifas. Mantener la combinación → categoría interna → grupo oficial → perfil. No sumar nuevamente vehículos cubiertos por una integración.

## Causas observadas
- priceRoute conserva providerFare pero descarta su total al no reconocer un bus.
- El catálogo de recorridos no contiene tarifas completas de buses ni clasificación suficiente.
- La continuidad A/B sólo funciona cuando toda la cadena es Metro, no dentro de una integración.
- El desglose oculta las razones de costos desconocidos dentro de details.

## Implementación (TDD)
1. Agregar pruebas de respaldo Google con moneda/procedencia explícitas, idempotencia y prioridad del tarifario local.
2. Investigar tarifas oficiales de buses; incorporar sólo coincidencias explícitas y documentadas en catálogo público cargado en ejecución. Mantener desconocidos los servicios sin respaldo.
3. Admitir cobros independientes de buses con tarifa completa documentada, sin simular una integración; probar suma, perfiles, duplicados y datos inválidos.
4. Normalizar continuidad A/B dentro de cadenas conservando índices/desglose y reglas de integración.
5. Mostrar procedencia, condiciones y motivos pendientes visibles. No atribuir tarifas de Google a un perfil Cívica ni fabricar desglose.
6. Ejecutar pruebas, TypeScript, compilación y validar interfaz. Documentar límites de cobertura, sin publicar ni hacer push.

## Salvaguardas
No editar rutas_integradas.json ni inferir precios a partir de números de rutas o cercanía geográfica. No sustituir validaciones con fechas fabricadas. Precios con fuente desconocida no son cero. Fuentes oficiales de buses y condiciones se registran en docs/bus-fare-research-2026-10-12.md.

## Ajuste por evidencia
La investigación no habilita ningún exact-match de bus solicitado. En lugar de inventarlo, ofrecer un presupuesto opcional por clase urbana y pago independiente confirmados por el usuario (bus/buseta o microbús de Medellín). Cargar los dos importes oficiales desde public/, validar vigencia y fuente, nunca seleccionarlos automáticamente. El presupuesto es CONDICIONAL y no representa una integración. No reemplazar reglas masivas conocidas ni un total del proveedor por este supuesto. Pruebas de totales completos, datos inválidos y aislamiento entre itinerarios.

## Hallazgo de verificación de extremo a extremo
La Estrella → Estadio en respaldo local no entregaba los puntos de subida/bajada y planTransit descartaba transit. Se agregaron datos estructurados del grafo sin horarios ficticios y se preservan sólo para recorridos con source local. La prueba localFareRoute utiliza CSV reales → getLocalOfflineRoute → planTransit → priceRoute; el total frecuente es 3820 con continuidad condicionada a permanecer en zona paga. El navegador local informa Google no configurado; no afirmar validación de Google en vivo.
