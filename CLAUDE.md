# Project conventions

**What this repository is.** A strangler-fig facsimile derived from `nest-domain-driven-hexagon`: an old hapi server (`packages/legacy-api`, being built) owns everything but the wallet, the NestJS server (`packages/server`) owns the wallet and is reached from hapi over HTTP. It exists to exercise the goodbones campaigns tooling. The plan is `docs/plan/strangler-facsimile-plan.md`; anything the tooling gets wrong or makes hard goes in `docs/plan/goodbones-findings.md` as it is hit. The hapi package deliberately does **not** follow the conventions below — it mirrors a legacy codebase (see the plan, §4) and its own rule file arrives with it.

The Nest server: NestJS + `@nestjs/cqrs`, hexagonal architecture, DDD, no Effect. Full rationale lives in `docs/adr/`; the working-memory digests live in `.claude/rules/`. ADR-0033 is the index of what changed in the port from the Effect edition.

**Before working in an area, read its rule file** — `.claude/rules/` is not auto-loaded, so pull in the relevant one:

| Working on…                                           | Read                                           | Backing ADRs                                  |
| ----------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Adding/moving files in a server feature module        | `.claude/rules/server-module-layout.md`        | 0002, 0003, 0013, 0022–0024, 0032             |
| New file kind, test, fake, stereotype (parity/layout) | `.claude/rules/server-file-taxonomy.md`        | 0008                                          |
| Writing or running server/jobs tests                  | `.claude/rules/server-testing.md`              | 0009                                          |
| Handlers, modules, event buses, SQL, auth (server)    | `.claude/rules/server-nest-and-persistence.md` | 0004, 0006, 0007, 0012, 0016–0017, 0020, 0033 |
| Something compiles but fails at boot, or lints oddly  | `.claude/rules/nest-cqrs-notes.md`             | 0033                                          |
| Frontend (`packages/web`, `packages/components`)      | `.claude/rules/frontend.md`                    | 0015, 0018, 0019, 0026                        |
| Anything in `packages/legacy-api`                     | `.claude/rules/legacy-api.md`                  | —                                             |
| Writing comments (any package)                        | `.claude/rules/comments.md`                    | —                                             |
| Any architectural boundary, file naming, rule probes  | `.claude/rules/architecture-rules.md`          | 0008, 0025, 0027–0031                         |

## Monorepo map

| Package             | What it is                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@org/legacy-api`   | The hapi server being strangled: routes/services/bookshelf models in `public`. Own rule file.                  |
| `@org/server`       | The Nest server (`src/modules/`, `src/platform/`, HTTP): the wallet today, the destination. Bulk of the rules. |
| `@org/web`          | Next.js App Router renderer + `/api/*` proxy; TanStack Query + MVVM (ADR-0026, 0018).                          |
| `@org/components`   | Bespoke component library (primitives + patterns) + Storybook (ADR-0015).                                      |
| `@org/contracts`    | Route definitions, zod schemas, errors, the generated `openapi.json` and `generated/api.ts` (ADR-0010).        |
| `@org/database`     | slonik client (`createDatabase`, `sql`, `RowSchemas`), knex migrator + migrations (ADR-0011).                  |
| `@org/event-bus`    | The domain event bus: `subscribe` / `subscribeAfterCommit` / `stream`, deferral, unhandled failures.           |
| `@org/unit-of-work` | The transactional boundary over a `TransactionDriver`; rolls back on `Err` (ADR-0007).                         |
| `@org/authz`        | The authorization DSL: `Check`, policy and resolver registries, `makeHasPermissions` (ADR-0021).               |
| `@org/cli`          | Command-line client (device-flow auth, organizations, todos).                                                  |
| `@org/mcp`          | MCP (stdio) server exposing the CLI surface as tools.                                                          |
| `@org/api-client`   | Shared `openapi-fetch` client + credential store for the CLI and MCP.                                          |
| `@org/acceptance`   | Playwright acceptance tests (specs / drivers / pages / infrastructure).                                        |
| `@org/test-drivers` | Tier-agnostic page-driver contracts + per-tier adapters (Playwright / RTL).                                    |

**Workspace kernel, installed engine.** The CQRS, unit-of-work and authorization patterns are the three `@org/*` workspace packages above, written from scratch for this edition and held apart from the server by their own manifest nodes (ADR-0029). The architecture engine is installed: `@goodbones/{core,typescript,cli,oxlint}` pinned to `0.1.0-beta.6`.

## Commands

| Command                                                | What it runs                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check:all`                                       | lint + lint:rules + lint:edges + lint:architecture + check + test + build-storybook (the full gate)                              |
| `pnpm check`                                           | `tsc -b` for every project, then builds contracts and type-checks web and components                                             |
| `pnpm lint`                                            | oxlint (type-aware) — the whole architecture policy (`architecture/*`) plus the ordinary rules                                   |
| `pnpm lint:rules`                                      | asserts each architectural rule still fires on a planted violation (ADR-0025)                                                    |
| `pnpm lint:edges`                                      | asserts the architecture policy still refuses — and allows — the edges it should (ADR-0028)                                      |
| `pnpm lint:architecture`                               | the same policy evaluated without a linter, plus the graph rules, the coverage floors, the conformance ceilings and the baseline |
| `pnpm architecture:conformance`                        | the full conformance report; its ceilings live in `limits.conformance` in `architecture.yaml` and only ratchet down              |
| `pnpm architecture:coverage`                           | how much of the tree each rule family reaches, and the tiers not yet tightened (ADR-0030)                                        |
| `pnpm architecture:facts <file>`                       | what the parser reads from one file — edges, bindings, members, exports; write new rules against this                            |
| `pnpm test`                                            | vitest **unit** suite (excludes `*.integration.test.ts`), no DB                                                                  |
| `DATABASE_URL_TEST=postgres://… pnpm test:integration` | **integration** suite only (`*.integration.test.ts`, server + database); hard-fails if no DB                                     |
| `DATABASE_URL_TEST=postgres://… pnpm coverage`         | unit + integration merged into ONE coverage number; thresholds in `vitest.config.ts` gate CI                                     |
| `pnpm test:acceptance`                                 | Playwright against a running stack                                                                                               |
| `pnpm contracts:generate`                              | regenerates `packages/contracts/openapi.json` and `src/generated/api.ts` from the route definitions                              |
| `pnpm -F @org/contracts build`                         | must precede a web typecheck or `next dev`; web's `pre*` scripts run it                                                          |
| `pnpm bootstrap` / `pnpm dev`                          | Docker (postgres, zitadel, jaeger) + migrate + seed; then server on :3001 and web on :3000                                       |

## Always in scope

- **The stack.** NestJS 12 with `@nestjs/cqrs` for `Command<R>`/`Query<R>` messages and `@CommandHandler`/`@QueryHandler` classes; `oxide.ts` `Result` in the functional core; zod for every schema; slonik behind `@org/database`; knex for migrations; `@org/contracts` route definitions → OpenAPI → `openapi-fetch` clients; TanStack Query v5 on the web. **Nest's own `EventBus`/`@EventsHandler`/`@Saga` are forbidden** (ADR-0007); the one event bus is `@org/event-bus`. Every message declares an explicit `XResult = Result<A, E>` alias; every injection names its token (`@Inject(Token)`); every handler returns a `Result`, and the unit of work rolls back on `Err`. Server-side gotchas are in `.claude/rules/nest-cqrs-notes.md`.
- **Comments are a last resort** — code is self-documenting, behavior is documented through tests. Full policy: `.claude/rules/comments.md`.
