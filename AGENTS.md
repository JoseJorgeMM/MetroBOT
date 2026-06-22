# Superpowers (auto-installed from `C:\Users\ASUS\Documents\superpowers`)

The skills in `C:\Users\ASUS\Documents\superpowers\skills/` are mirrored
into `$CODEX_HOME/skills/.system/superpowers/` so Codex loads them at
session start. Before responding to ANY request (including a clarifying
question) you MUST read and follow:

- `superpowers:using-superpowers` (the bootstrap that says how to pick
  which other skills apply)
- `superpowers:brainstorming` (mandatory for any creative work ?
  features, components, behavior changes)
- `superpowers:verification-before-completion` (no completion claims
  without fresh evidence)
- `superpowers:systematic-debugging` (any bug or test failure)
- `superpowers:test-driven-development` (any implementation work)
- `superpowers:writing-plans` (multi-step tasks before touching code)

Workflow for any non-trivial request:

1. Apply `brainstorming` before writing any code.
2. After design approval, invoke `writing-plans` and persist the plan
   to `docs/superpowers/plans/<YYYY-MM-DD>-<topic>.md`.
3. Implement following the plan and `test-driven-development`.
4. Use `verification-before-completion` to gate every "done" claim with
   fresh evidence (lint, build, tests).
5. Use `dispatching-parallel-agents` / `subagent-driven-development`
   when a task can be split into independent chunks.

## Project-specific notes (MetroBOT)

- Frontend stack: Vite + React 19 + TypeScript + react-leaflet.
- All data lives under `public/`. The app fetches `/rutas_integradas.json`
  at runtime; never bundle the route data into JS source.
- Do not modify `public/rutas_integradas.json` by hand ? re-run
  `node compile_new_routes.cjs` after touching CSVs.
- For new Excel files dropped in `public/rutas_pendientes/`, run
  `node split_pendientes.cjs` (idempotent) before compiling.

## Codex tool-name mapping (Claude Code ? Codex)

| Skill references       | Codex equivalent                           |
|------------------------|--------------------------------------------|
| Skill                  | Skill tool (auto-discovery)                |
| Read                   | view_image / Get-Content / native reads    |
| Write / Edit           | apply_patch / Set-Content / native writes  |
| Bash                   | exec_command                               |
| TodoWrite              | update_plan                                |
| Task (subagent)        | multi_agent_v1 (spawn_agent / wait_agent)  |

