# Plan: a hapi → Nest strangler facsimile for the goodbones campaigns tooling

Status: approved 2026-09-27; living document, amended as steps land. Source of the legacy shape: a long-lived production hapi API (private), read for its conventions only; none of its code or features is copied.
Source of the behaviour: this repo (`nest-domain-driven-hexagon`) at HEAD.

## 1. Goal

A new repository with two servers over one Postgres database:

- `@org/legacy-api` — a hapi server that owns users, auth (Zitadel BFF cookie sessions, API tokens,
  device flow), organizations/invitations/roles, todos and billing. Shaped like that codebase:
  electrolyte IoC, `*-routes` + `*-service` + `*-model` + `*-access` per module, bookshelf models in
  `public`, virgen-style ACL, Joi + async validation, permission logic leaking into route files.
- `@org/server` — the existing Nest server reduced to the wallet module, reached only by
  machine-to-machine HTTP from hapi (inter-service JWT), with compensation in hapi when the
  surrounding transaction fails.

Purpose: a realistic starting state for a goodbones **campaign** that strangles responsibility out of
hapi into Nest, and a place to record the tooling's rough edges as they are hit.

## 2. Decisions to confirm

| #   | Decision                             | Recommendation                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Repo name / history                  | `dataquail/hapi-nest-strangler`, fresh `git init` from a `git archive` of this repo's HEAD. The campaign ledger and history start at the transitional state; the port's history stays in this repo.                                                                                              |
| 2   | Base revision                        | HEAD only. The uncommitted orval/web changes here are not carried over.                                                                                                                                                                                                                          |
| 3   | Language/runtime of the hapi package | TypeScript compiled as **CommonJS** (as the reference API does: `module: commonjs`, `noImplicitAny: false`, `tsc` + path alias), with **electrolyte** `@require` string ids and bookshelf's string model registry. Faithful, and it is exactly the implicit wiring a dependency tool cannot see. |
| 4   | Database                             | One database. hapi owns `public.*` with its own knex `migrations/` folder and `knexfile`; Nest keeps only the `wallet` schema in `@org/database`. No cross-service FK: `wallet.wallets.organization_id` is a plain uuid.                                                                         |
| 5   | Nest trimming                        | Delete every module but wallet, and every platform piece that loses its last consumer (`AuthenticatorLive`, `UserAuthGuard`, `@Caller`, cookie codec, notifications). The campaign brings them back with their module. The kernel packages stay.                                                 |
| 6   | Wallet API surface                   | Internal only: `POST /internal/wallets`, `DELETE /internal/wallets/{organizationId}`, `GET /internal/wallets/{organizationId}`. No credit/debit endpoints yet (no existing caller). Can be widened later to give billing a second compensation site.                                             |
| 7   | Auth between servers                 | HS256 inter-service JWT with a shared secret (`INTER_SERVICE_JWT_SECRET`), minted in hapi's `lib/backend-client`, verified by a Nest `InterServiceAuthGuard`. The shape a legacy API typically grows for its first service-to-service call.                                                      |
| 8   | Test runner for hapi                 | vitest, keeping the reference layout: `*.spec.ts` unit tests beside services (mock-heavy), `test/application/<module>/*.integration.test.ts` lab-style `server.inject` tests over a real DB, `test/helpers/{factory,db,sessions}`. One `pnpm test` / `pnpm test:integration` for the whole repo. |
| 9   | Ports                                | hapi `:9000` (the reference API's port), Nest `:3001`, web `:3000` proxying `/api/*` to hapi.                                                                                                                                                                                                    |
| 10  | goodbones version                    | Bump to the latest published beta (`@goodbones/cli` 0.1.0-beta.14; campaigns ship as `@goodbones/campaigns`) as the first commit, so the base is green before hapi lands.                                                                                                                        |
| 11  | Review unit                          | One PR-sized commit per step in §6; a `gh stack` if the new repo gets a GitHub remote up front.                                                                                                                                                                                                  |

## 3. Repository layout

```
hapi-nest-strangler/
  architecture.yaml                      # root policy; adds the legacy-api node (open, unrestricted)
  docker-compose.yml                     # unchanged: postgres, zitadel, jaeger
  packages/
    legacy-api/                          # NEW — the hapi server (§4)
    server/                              # Nest, wallet only (§5)
    contracts/                           # unchanged paths + InternalWalletContract
    database/                            # slonik kernel + wallet-only migrations/row schemas
    event-bus/ unit-of-work/ authz/      # unchanged kernel packages
    web/                                 # proxy target → hapi; no feature changes
    components/ test-drivers/            # unchanged
    cli/ mcp/ api-client/                # unchanged (hapi serves /cli/*)
    acceptance/                          # global-setup starts both servers
    jobs/                                # REMOVED; session purge becomes legacy-api/src/bin/
  docs/adr/0034-two-servers-strangler-transitional-state.md
  docs/plan/strangler-facsimile-plan.md  # this file
  docs/plan/goodbones-findings.md        # rough edges, appended as hit
```

## 4. `packages/legacy-api` (mirrors the reference API)

```
legacy-api/
  server.ts  manifest.ts  bootstrap.ts  config.ts  config-files/  knexfile.ts
  constants/acl/{role,resource,action}-constants.ts  role-resource-init.ts   # alias `constants/*`
  migrations/  seeds/  templates/                                            # knex, public schema
  src/
    application/
      models.ts                          # the bookshelf model registry, by string name
      user/          user-routes.ts user-service.ts user-model.ts role-model.ts user-access.ts
      auth/          auth-routes.ts auth-service.ts session-model.ts api-token-model.ts
                     device-grant-model.ts auth-identity-model.ts verify-session.ts token-utils.ts
                     oidc-client.ts cli-device-routes.ts
      organization/  organization-routes.ts organization-service.ts organization-model.ts
                     membership-model.ts invitation-model.ts organization-role-model.ts
                     organization-access.ts invitation-email.ts
      todo/          todo-routes.ts todo-cli-routes.ts todo-service.ts todo-model.ts todo-access.ts
      billing/       billing-routes.ts billing-service.ts subscription-model.ts
                     webhook-event-model.ts stripe-gateway.ts billing-access.ts
    lib/
      access/{acl,can,canAll,canSome,aclQueryPromise}.ts   # virgen-acl
      hapi-async-validation/{asyncValidation,ValidationError,bookshelf/row-exists…}.ts
      backend-client/{index,http,domains/wallets}.ts        # → Nest, inter-service JWT
      bookshelf.ts knex.ts joi.ts logger.ts email/ stripe.ts session-constants.ts
    bin/purge-expired-sessions.ts
  test/
    server.ts  helpers/{factory,db,sessions,mock-services}.ts
    application/<module>/*.integration.test.ts
```

**Behaviour ported, shape not.** Every command/query in the Nest modules becomes a service method
or route handler; every invariant in a `*RootOps` becomes an inline check in a service (or in a route
pre-handler, see the smell list). The `@org/authz` policies become `*-access.ts` files registering
assertions on the ACL. The HTTP contract paths stay identical so web, CLI and MCP keep working.

| Nest module             | hapi module     | `public` tables                                                     |
| ----------------------- | --------------- | ------------------------------------------------------------------- |
| user + role             | `user/`         | `users`, `roles`                                                    |
| auth                    | `auth/`         | `sessions`, `api_tokens`, `device_grants`, `auth_identities`        |
| organization            | `organization/` | `organizations`, `memberships`, `invitations`, `organization_roles` |
| todos (+ CLI endpoints) | `todo/`         | `todos`                                                             |
| billing                 | `billing/`      | `subscriptions`, `webhook_events`                                   |
| wallet                  | _not ported_    | stays `wallet.wallets`, owned by Nest                               |

**Intentional legacy traits** (so the campaign has something to measure):

- Services are `@singleton` classes or plain object bags injected by string id; services require
  other services (`organization-service` → `user-service`, `billing-service`, `backend-client`).
- `user-model.ts` constructs a `UserService` (model → service dependency, as the reference API's does).
- `lib/access/acl.ts` requires every module's `*-access.ts` (the hub every module hangs off).
- Route files carry `fromOwnOrganization`-style pre-handlers, inline role checks in handlers
  (e.g. "super admin cannot own an organization" lives in `organization-routes.ts`, not the service),
  and one-off permission files (`can-edit-<thing>.ts`).
- Knex transactions opened in services, passed as `{ transacting }`, with an HTTP call to Nest made
  **inside** the open transaction.
- Joi schemas duplicated per route rather than shared with `@org/contracts`; a parity test guards the
  route table against the contracts' route list.
- Domain events are hapi `server.events` (a domain-event-handler plugin) with handlers that
  reach services directly, replacing `@org/event-bus` subscriptions
  (e.g. invitation-created → send email).

## 5. `packages/server` (Nest, wallet only)

- Modules: `wallet` only. `platform/modules/application-modules.ts` lists it alone.
- New `interface/http/{create,delete,get}-wallet.endpoint.ts` under `InterServiceAuthGuard`
  (`platform/middlewares/inter-service-auth.guard.ts`), routes from `InternalWalletContract`.
- Commands: `CreateWalletCommand` (exists; idempotent, now returns the wallet id),
  `DeleteWalletCommand` (compensation; idempotent). Query: `FindWalletByOrganizationQuery`.
- `OrganizationEventAdapter` and `wallet.imports.ts` go (no organization module to listen to).
- `@org/database`: migrations reduced to `create_schema_wallet` + `create_table_wallet_wallets`
  (uuid `organization_id`, unique, no FK); `MODULE_SCHEMAS = ["wallet"]`; row schemas trimmed.
- Deleted as consumer-less: `UserAuthGuard`, `@Caller`, `Authenticator` port + live, cookie codec,
  notifications/mailer, `BillingGatewayModule`, `AuthzModule` contributions. `AuthzModule` itself and
  `@org/authz` stay (empty registries) as the landing platform.
- Manifest: the server node shrinks accordingly; `lint:edges` rows for removed modules are dropped.

## 6. The seam: organization creation with compensation

```
hapi organization-service.create(payload, actor)
  knex.transaction(trx):
    insert organizations, memberships, organization_roles      (trx)
    backendClient.wallets.create({ organizationId })            ← HTTP to Nest, inside trx
      ├─ 4xx/5xx/timeout → throw → trx rolls back → 502 to caller
      └─ 201/200 (idempotent) → continue
    commit
  commit failure after the wallet call → backendClient.wallets.delete(organizationId), logged,
  best-effort; then rethrow.
```

Tests: a unit spec with the client stubbed (rollback on wallet failure; delete called on commit
failure); an integration test with a local fake wallet HTTP server; one acceptance spec through
the full stack (create org in the UI → `wallet.wallets` row exists). The first two landed with
step 8; the acceptance spec lands with step 10, when the suite is re-pointed at both servers.

## 7. Cross-cutting changes

- **web**: `SERVER_INTERNAL_URL=http://localhost:9000`; no other change expected.
- **contracts**: unchanged public groups; add `InternalWalletContract` (excluded from the public
  OpenAPI document or tagged internal).
- **cli / mcp / api-client**: unchanged; hapi implements `/cli/*`.
- **acceptance**: global setup and `pnpm dev` start hapi, Nest and web; DB truncation covers both
  `public` and `wallet`.
- **scripts**: `dev-bootstrap` migrates both migrators; `test:integration` gains the legacy-api project.
- **.env**: `LEGACY_API_PORT`, `NEST_SERVER_URL`, `INTER_SERVICE_JWT_SECRET`.

## 8. goodbones: manifest stance and the rough edges to look for

- `packages/legacy-api/architecture.yaml`: one node, `layout: open`, an `imports` allowlist of itself,
  `node:**` and its own dependencies (revised from `unrestricted` at step 5 — see findings 4, 5), a
  no-`export *` surface rule, `no-orphans` entries for the container-scanned folders; `no-cycles`
  gets `withinNot: [legacy-api]` (the service hub is cyclic by construction); two `reach` rules keep
  the legacy API and the Nest code apart.
- Resolution: a new `resolve.scopes` entry for the CJS tsconfig with the `constants/*` alias.
- Expected edges to record in `docs/plan/goodbones-findings.md`: `require()` and `ioc.create("x/y")`
  edges the graph cannot see; an open, unrestricted package's effect on the coverage floors; whether a
  CJS `export =` module gets a usable surface; the `deny` on tests vs. reference-style `test/` trees;
  how the campaign perimeter will name a hapi module spread over `src/application/<m>/`,
  `migrations/`, `test/application/<m>/` (`marker` + `owns`).

## 9. Execution order (one reviewable step each)

1. New repo from HEAD; rename; README/CLAUDE.md pointers; commit the plan.
2. Bump goodbones to the latest beta; gate green.
3. Nest trim: wallet-only modules, internal wallet HTTP + inter-service guard, database package to
   wallet-only, delete consumer-less platform code, contracts `InternalWalletContract`. `@org/jobs`
   goes with it (its one job read the auth schema); the session purge returns in hapi at step 5.
4. Scaffold `legacy-api`: hapi + glue + electrolyte + bookshelf/knex + config + logger +
   `/health-check`; manifest node; vitest project; env, compose, `pnpm dev`.
5. hapi migrations for all `public` tables + seeds; session purge rewritten in `src/bin`.
6. hapi auth + user + roles + ACL/`can`; web login works against hapi.
7. hapi organization module; invitation email; domain-event plugin.
8. The seam: `backend-client`, compensation in `organization-service`, its three tests.
9. hapi todos (+ CLI routes) and billing (Stripe gateway, webhook ingest, subscriptions).
10. Acceptance/CLI/MCP re-pointed and green; ADR-0034; rules digests and CLAUDE.md updated;
    findings log.
11. (Next engagement) the strangler campaign in `architecture.yaml`.
