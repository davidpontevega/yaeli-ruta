@AGENTS.md

# Yaeli Ruta — Distribuidora Yaeli

Stock + reparto offline for a consumer-goods distributor. Full plan and domain in `PLAN.md` (Spanish; domain terms in Spanish).

**Rules of work: `docs/SETUP.md` (folder structure, SOLID/DRY/KISS/YAGNI, reuse-before-create, SDD, tests). It wins over anything else.**
Entry rule: classify every coding request with the `orchestrator` agent (BUILD vs SDD) unless the user names the mode. SDD = `spec` → human approval → `developer` ⇄ `reviewer` (max 2 rounds). Agents in `.claude/agents/`, specs in `docs/specs/NNN-slug.md`.

## Commands
`npm run dev` · `build` · `lint` · `typecheck` · `test` (node:test, `src/**/*.test.ts`, pure functions only) · `db:generate` · `db:migrate` · `db:studio`.
Verify before finishing: `npm run typecheck && npm run lint && npm test && npm run build`.

## Architecture
- Next.js 16 App Router, no `cacheComponents`. Mutations = Server Actions next to the page (`actions.ts`); offline sync (phase 4) will use Route Handlers.
- DB: Drizzle + Neon via `Pool` (WebSocket) because stock/orders/payments need `db.transaction`. Schema in `src/server/db/schema.ts`; migrations in `drizzle/`. There is only one Neon database (production) — never run destructive SQL against it.
- Auth is custom (no Clerk): user list + 4–6 digit PIN (scrypt), 5 failures → 15 min lock. Cookie `yr_sesion` holds a random token; DB stores only its SHA-256 in `sesiones`. `src/proxy.ts` only checks the cookie exists; real check is `requerirUsuario(...roles)` in `src/server/auth.ts` — call it in every page and every server action.
- Roles: `DUENO`, `REPARTIDOR`. Repartidor must never see costs or margins.
- `auditar(tx, …)` in the same transaction as the mutation; never log PINs or tokens.
- Money in integer céntimos, quantities in integer base units.
