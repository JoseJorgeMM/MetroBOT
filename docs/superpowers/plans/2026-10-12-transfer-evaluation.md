# Transfer Evaluation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Preserve the existing uncommitted fare work. No push/deploy.

**Goal:** Asistencia documentada y panel local del piloto San Antonio con indicadores trazables.
**Architecture:** Módulo puro valida y resume sesiones v2; React captura/importa/exporta en memoria; datos sintéticos públicos separados. Gemini existente permanece como OCR consentido, sin ampliar llamadas ni datos enviados.
**Tech Stack:** React 19, TypeScript, Vite, node:test/tsx, happy-dom.

### 1. Contrato y motor (agente principal)
- [x] Crear tests/pilotEvaluation.test.ts antes de src/lib/pilotEvaluation.ts. RED: importar funciones ausentes.
- [x] Implementar tipos PilotSession/PilotContext/PilotPhase; parsePilotSession(text) lanza error localizado ante v1, extra keys, JSON inválido, >128KiB, UUID inválido, pares duplicados, enum desconocido. mergePilotSessions(current,incoming) devuelve {sessions,added,duplicates,conflicts}; conflictos no sobreescriben.
- [x] Implementar summarizePilot(sessions): {sessions,field,practice,unassigned,stages}; stages contiene connection/sign con {answered,unclear,helpNeeded,useful}. summarizePilot(sessions.filter(s=>s.context==='field'&&s.phase==='baseline')) y assisted separadas, sin porcentaje con answered=0.
- [x] GREEN: node --import tsx --test tests/pilotEvaluation.test.ts.

### 2. Captura voluntaria (subagente, archivos aislados)
- [x] Componente TransferEvaluation.tsx y test de interacción propios, sin modificar TransferCompanion. Props catalogVersion:1. Estado efímero y UUID por participación; contrato compatible con pilotEvaluation. Práctica por defecto; etapa y categorías cerradas, exportación v2, borrado/revocación, selección de contexto/fase bloqueada una vez haya observaciones. Sin fetch ni almacenamiento.
- [x] RED/GREEN node --import tsx --test tests/transferEvaluation.test.tsx. Revisar exportación y privacidad.

### 3. Panel (agente principal)
- [x] Tests React antes de PilotDashboard.tsx. Botón Evaluar piloto en Conexiones abre panel lazy y cierre descarta estado.
- [x] Implementar importación bounded async con exclusión mutua durante lecturas y desmontaje al cerrar (sin reutilizar el estado anterior). Resultado por archivo sin mostrar nombres originales. Rechazar informes antiguos explicando v2. No registrar contenido en consola.
- [x] Modo importado vacío predeterminado; botón demostración obtiene /transfers/pilot-demo.json validado, separado de importados, con aviso permanente. Descargar informe agregado incluye modo, versión, límites, conteos y comparación; no IDs, observaciones individuales ni fechas de usuario.
- [x] Tabla de etapas con n/N, estados vacíos, notas de interpretación, filtros descriptivos referencia/asistida sólo de campo; no ranking con porcentajes sin muestra.

### 4. Integración y evidencia
- [x] Integrar captura sustituyendo evaluación v1 y actualizar pruebas que documentaban contrato viejo. Preservar lectura OCR, cancelación, revisión humana y precios previos.
- [x] Tarjeta muestra fare opcional desde RouteComparison; explicitar permanencia en zona paga sin certificar ubicación. Apertura desde JourneyStudio no inventa precio.
- [x] Añadir docs/pilot-evaluation.md con flujo de demo, protocolo de referencia/experiencia asistida, privacidad y límites. Autorrevisar spec y código, revisión independiente.
- [x] npm run lint; node --import tsx --test tests/*.test.ts tests/*.test.tsx; node --test tests/test_*.mjs; npm run build (sin build simultáneo a legacy).
- [x] Navegador localhost: abrir panel → modo demo → indicadores → volver importado vacío; revisar sesión consentida/exportación y sin errores relevantes. No presentar datos sintéticos como impacto.

## Evidencia · 2026-10-12
- TDD RED/GREEN observado para motor, captura, panel y contrato integrado v2.
- npm run lint: correcto. Suite TypeScript/React: 275/275. Suites heredadas: 18/18.
- npm run build: correcto; persiste aviso previo de bundle principal >500 kB. Panel separado en chunk lazy (~10.6 kB).
- Revisión independiente: corregido rechazo de namespace sintético en importaciones. Sin otros hallazgos reportados.
- Navegador: demostración 5 sesiones; importado vacío aislado; exportación práctica → importación 1 sesión → reimportación 1 duplicada y total sin aumentar. Consola sin errores en el flujo observado.
- No push ni despliegue. No nueva llamada real a Gemini ni afirmación de impacto medido en campo.

