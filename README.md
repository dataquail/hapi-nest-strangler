# hapi-nest-strangler

A strangler-fig facsimile: one application split across an old **hapi** server and a new **NestJS** server, at the moment the migration has only just begun. It is derived from [`nest-domain-driven-hexagon`](https://github.com/dataquail/nest-domain-driven-hexagon) — the same users, organizations, invitations, roles, todos, wallet, auth and billing — with everything but the wallet module rebuilt in the shape of a long-lived hapi codebase: controllers and services in giant bags of functions, bookshelf models in one `public` schema, an in-memory ACL, permission logic leaking into route files. The wallet stays on the hexagonal Nest server and is reached from hapi over HTTP, with compensation when the surrounding transaction fails.

The repository exists to put the [goodbones](https://dataquail.github.io/goodbones) **campaigns** tooling to work on a realistic strangling and to find its rough edges. [docs/plan/strangler-facsimile-plan.md](docs/plan/strangler-facsimile-plan.md) is the plan; [docs/plan/goodbones-findings.md](docs/plan/goodbones-findings.md) is the log of what the tooling got wrong or made hard.

A monorepo containing:

- `packages/legacy-api`: the hapi server — owns users, auth, organizations, todos and billing; the browser, CLI and MCP talk to it ([ADR-0034](docs/adr/0034-the-strangler-facsimile.md))
- `packages/server`: the NestJS server — owns the wallet module, reached only server-to-server ([ADR-0016](docs/adr/0016-authentication-with-self-hosted-zitadel.md) describes the auth model the hapi server inherits)
- `packages/web`: Next.js (App Router) renderer; proxies `/api/*` to the hapi server ([ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md))
- `packages/contracts`: route definitions and zod schemas; generates `openapi.json` and the typed client paths ([ADR-0010](docs/adr/0010-http-only-contracts.md))
- `packages/database`: slonik client, knex migrator and the Nest server's migrations ([ADR-0011](docs/adr/0011-migrations-strategy.md))
- `packages/event-bus`, `packages/unit-of-work`, `packages/authz`: the framework-free kernel the Nest server is built on ([ADR-0007](docs/adr/0007-unit-of-work-and-one-event-bus.md), [ADR-0021](docs/adr/0021-per-route-authorization-dsl.md))
- `packages/components`: the component library + Storybook ([ADR-0015](docs/adr/0015-frontend-component-library.md))
- `packages/cli`, `packages/mcp`, `packages/api-client`: the command-line client, the MCP server and the client they share
- `packages/acceptance`, `packages/test-drivers`: Playwright acceptance suite and the tier-agnostic page drivers

Until the plan's later steps land, the sections below describe the inherited single-server setup.

## Setup in a codespace

The whole stack — Postgres, migrations, Zitadel with a seeded OIDC app and admin user, Mailpit, Jaeger — comes up provisioned when you create a codespace. See [docs/codespaces.md](docs/codespaces.md); one manual step (making port 8080 public) is called out there.

## Prerequisites

To run locally instead:

- **Node 22** — `.nvmrc` pins the version CI runs; `engines.node` accepts any 22.x at or above it.
- **pnpm 10.3.0** — auto-activated by [corepack](https://nodejs.org/api/corepack.html). Run `corepack enable` once.
- **Docker Desktop** (or any Docker + docker compose v2) — runs Postgres, Zitadel, Mailpit and Jaeger.

The server runs TypeScript directly through [tsx](https://github.com/privatenumber/tsx); no build step is needed for development.

## Setup

```bash
pnpm install
pnpm bootstrap   # .env, Docker, migrations, Zitadel seed — idempotent
pnpm dev         # hapi API on :9000, Nest server on :3001, web on :3000
```

[docs/dev-setup.md](docs/dev-setup.md) walks through what `pnpm bootstrap` does phase by phase and how to run any step by hand. The pieces you will most often run alone:

```bash
# Migrate the dev and test databases. Two migrators share each database:
# the hapi server's owns every public table (tracked in `knex_migrations`),
# the Nest server's owns the wallet schema (tracked in `knex_migrations_nest`).
pnpm --filter @org/legacy-api db:migrate && pnpm --filter @org/database db:migrate
pnpm --filter @org/legacy-api db:migrate:test && pnpm --filter @org/database db:migrate:test

# Replay one side from scratch; each reset leaves the other server's tables standing
pnpm --filter @org/legacy-api db:reset
pnpm --filter @org/database db:reset

# Regenerate openapi.json and packages/contracts/src/generated/api.ts after changing a route
pnpm contracts:generate

# Build the contracts package — required before web type-checks or `next dev`
# (web's predev / prebuild / pretypecheck run it for you)
pnpm -F @org/contracts build
```

The database itself is created by `infra/postgres/init/` on the volume's first boot; `DATABASE_URL` and `DATABASE_URL_TEST` in `.env.example` point at `nest-hexagon` and `nest-hexagon-test`.

## Authentication (Zitadel)

The server uses [Zitadel](https://zitadel.com) (self-hosted via docker compose) as the OIDC identity provider. The browser never holds an access or id token; the server is the OIDC client and issues an `HttpOnly` session cookie scoped to the Next origin. See [ADR-0016](docs/adr/0016-authentication-with-self-hosted-zitadel.md), [ADR-0017](docs/adr/0017-frontend-auth-flow.md) and [ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md).

`pnpm bootstrap` brings Zitadel up, waits for its bootstrap PAT, seeds the `nest-hexagon` project and `nest-hexagon-bff` app, and writes the client id and secret into `.env`. To do it by hand:

```bash
pnpm auth:up      # Zitadel + its Postgres
pnpm auth:seed    # OIDC project + app + the admin row in the dev DB; prints ZITADEL_CLIENT_ID / _SECRET
pnpm auth:reset   # tear down and start over
```

After signing in once at `http://localhost:3000/api/auth/login`, the session cookie is set on the Next origin and protected endpoints work normally.

**Acceptance tests** (Playwright) drive the real Zitadel hosted UI — make sure the stack is seeded and the dev servers on `:3000` / `:3001` are stopped before `pnpm test:acceptance`.

## Billing (Stripe)

Billing lives on the hapi server, behind one Stripe gateway factory that hands back the SDK or an in-memory stand-in when `STRIPE_USE_FAKE=true` (the `.env.example` default). Tests always use the stand-in; the `STRIPE_*` placeholders are enough for `pnpm test` and `pnpm check:all`.

For the real-Stripe smoke loop against test-mode Stripe:

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID_DEFAULT` from your dashboard.
2. Run `stripe listen --forward-to localhost:9000/webhooks/stripe`; copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. Unset `STRIPE_USE_FAKE` and restart the hapi server.
4. `POST /api/orgs/:orgId/billing/subscriptions` as an org admin; the CLI forwards `customer.subscription.created` back to your webhook.

## Development

```bash
pnpm --filter @org/legacy-api dev # hapi API, watch mode, port 9000 — the BFF
pnpm --filter @org/server dev     # Nest server, watch mode, port 3001 — the wallet (OTel via tsx --import)
pnpm --filter @org/web dev        # Next.js on 3000; builds contracts first; /api/* rewrites to :9000
```

Browser → Next.js → `/api/*` rewrite → hapi API → (creating an organization) → Nest server over `/internal/wallets` with the inter-service token; the session cookie scopes to `:3000`. Jaeger is at http://localhost:16686, Mailpit at http://localhost:8025. Run them in separate terminals, or use the **Dev: All** VS Code task.

`packages/contracts` is the vocabulary both servers implement: the hapi server serves the domain and CLI routes, the Nest server the internal ones, and a parity test on the hapi side holds its hand-written route table to the contracts. The CLI, MCP server, web and both servers' test clients are `openapi-fetch` clients typed by `packages/contracts/src/generated/api.ts`.

## Checking and testing

```bash
pnpm check:all                                    # the full gate: lint, rule probes, edges, architecture, conformance, typecheck, tests, storybook
pnpm lint                                         # oxlint, type-aware, including the architecture policy
pnpm test                                         # unit suite, no database
DATABASE_URL_TEST=postgres://… pnpm test:integration
DATABASE_URL_TEST=postgres://… pnpm coverage      # unit + integration merged; thresholds gate CI
pnpm test:acceptance                              # Playwright: boots hapi, Nest and web against the test DB; needs the Zitadel entries in .env
```

The architecture policy lives in `architecture.yaml` plus one `architecture.yaml` per package and is evaluated by [goodbones](https://dataquail.github.io/goodbones) inside `pnpm lint` and `pnpm lint:architecture`. `pnpm architecture:explain <file>` says what governs a file; `.claude/rules/architecture-rules.md` explains the manifest.

## Where to read next

- `docs/adr/` — every decision, re-authored for this edition; start at [ADR-0033](docs/adr/0033-porting-from-effect-to-nest.md).
- `docs/plan/strangler-facsimile-plan.md` — the plan this repository is being built to; `docs/plan/goodbones-findings.md` — the tooling findings it exists to collect.
- `docs/plan/nest-port-plan.md` — the plan the Nest edition followed, inherited.
- `CLAUDE.md` and `.claude/rules/` — the working-memory digests for humans and agents.
