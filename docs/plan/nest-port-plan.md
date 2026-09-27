# Plan: porting functional-domain-driven-hexagon to NestJS + CQRS

Status: living document. Written before the first line of code; amended as decisions land.
Source of truth for _what the original does_: `../functional-domain-driven-hexagon` (sibling
checkout). Source of truth for _why_: its `docs/adr/`. This repo keeps the architecture and
replaces the runtime.

## 1. Goal

Rebuild the same application — users, organizations, invitations, org/platform roles, todos,
wallets, auth (Zitadel OIDC session + API tokens + device flow), billing (Stripe) — on a stack
with no Effect anywhere:

| Concern                           | Original                                              | This repo                                                                             |
| --------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Functional core / domain boundary | `effect/Result`, `Schema.Class`, `Schema.TaggedError` | `oxide.ts` (`Result`, `Option`), `zod` aggregates, hand-rolled tagged errors          |
| DB access                         | `effect/unstable/sql` + `@effect/sql-pg`              | `slonik` (pool, `sql.type(zodSchema)`, nested transactions) + `zod` row schemas       |
| Migrations                        | `effect/unstable/sql/Migrator`                        | `knex` (programmatic, static migration source, schema-qualified raw DDL)              |
| DTO / API contract                | `effect/unstable/httpapi` groups                      | `zod` schemas + `@asteasolutions/zod-to-openapi` → committed `openapi.json`           |
| Backend framework                 | Effect `HttpApiBuilder` + Layers                      | NestJS 12 (express), `@nestjs/cqrs` `CommandBus`/`QueryBus`, Nest modules as wiring   |
| Domain event bus                  | `@effect-server-utils/cqrs` `EventBus`                | `@org/event-bus` (workspace pkg, written from scratch, same three delivery contracts) |
| Unit of work                      | `@effect-server-utils/unit-of-work`                   | `@org/unit-of-work` (workspace pkg, written from scratch, `AsyncLocalStorage` scope)  |
| Authorization DSL                 | `@effect-server-utils/authz`                          | `@org/authz` (workspace pkg, written from scratch, Promise + `Result`)                |
| Frontend state                    | Effect Atom + `@effect/atom-react`                    | TanStack Query v5 + `openapi-fetch` typed client                                      |
| Frontend framework                | Next.js 16 App Router                                 | unchanged                                                                             |
| Component library                 | `@org/components`                                     | unchanged (drop its `effect` import)                                                  |
| CLI                               | `effect/unstable/cli`                                 | `commander`                                                                           |
| Architecture enforcement          | goodbones (`@goodbones/*`) manifest                   | unchanged engine; manifest rewritten for the new externals and file kinds             |
| Tests                             | vitest + `@effect/vitest`                             | vitest (+ `unplugin-swc` for decorator metadata), Nest `Test.createTestingModule`     |
| Observability                     | Effect spans → OTLP                                   | OpenTelemetry SDK (auto-instrumentation) + manual spans around bus dispatch           |

Everything the ADRs decide _architecturally_ carries over: module layout (ADR-0002), aggregates
as dumb data + free-function ops (ADR-0001/0003), errors as tagged classes (ADR-0004), dumb
repositories + specifications (ADR-0005), typed buses (ADR-0006), unit of work + one event bus
with subscription-chosen consistency (ADR-0007), architecture as a manifest (ADR-0008/0027–0031),
testing pyramid (ADR-0009), per-module DB schemas (ADR-0020), per-route authz DSL (ADR-0021),
consumer-owned outbound ports (ADR-0022), domain services / interface utils (ADR-0023), dot-
delimited stereotypes (ADR-0024), oxlint (ADR-0025), module imports/exports gateways (ADR-0032).
The ADRs are re-authored in this repo with the Effect-specific mechanisms replaced; ADR-0026 (Atom
MVVM) is superseded by a TanStack Query MVVM ADR.

## 2. Repository layout

```
nest-domain-driven-hexagon/
  architecture.yaml               # repo-wide policy (goodbones), includes one node per package
  packages/
    contracts/                    # @org/contracts — zod DTOs, route definitions, openapi.json
    database/                     # @org/database  — slonik kernel, zod row schemas, knex migrations
    event-bus/                    # @org/event-bus — Event.make, EventBus, DeferralSink seam, UnhandledFailures
    unit-of-work/                 # @org/unit-of-work — UnitOfWork, TransactionDriver, PersistenceUnavailable
    authz/                        # @org/authz — PolicyRegistry, ResourceResolverRegistry, hasPermissions
    server/                       # @org/server — NestJS BFF (modules/, platform/, test-utils/)
    web/                          # @org/web — Next renderer + TanStack Query MVVM
    components/                   # @org/components — unchanged
    api-client/                   # @org/api-client — openapi-fetch client over the CLI API + credentials
    cli/                          # @org/cli — commander
    mcp/                          # @org/mcp — MCP stdio server
    jobs/                         # @org/jobs — cron-style jobs over slonik
    acceptance/                   # @org/acceptance — Playwright
    test-drivers/                 # @org/test-drivers — unchanged
  docs/adr/                       # re-authored ADRs
  docs/plan/                      # this file
  scripts/                        # lint probes, edges, conformance, bootstrap
  infra/                          # postgres init, zitadel seed, jaeger config (copied)
```

Three new workspace packages replace the three `@effect-server-utils/*` libraries. They stay
framework-free (no Nest, no slonik) so the server's `domain/` tier can name their domain-safe
modules through `platform/ddd/contracts/` exactly as before, and so the manifest can fence their
factories to composition roots by symbol.

## 3. Kernel designs

### 3.1 Domain core (`oxide.ts` + `zod`)

- **Aggregate roots** are zod object schemas: `export const TodoRoot = z.object({...}).readonly(); export type TodoRoot = z.infer<typeof TodoRoot>;` Construction is `TodoRoot.parse(...)` (the `make` of ADR-0003 — it enforces the field invariants). Same for value objects. Timestamps are `Date` (UTC).
- **Branded IDs**: `z.uuid().brand<"TodoId">()`; `TodoId.parse(raw)` to mint from a string.
- **Ops** return `Outcome` or `Result<Outcome, DomainError>` from `oxide.ts`. Handlers consume with `if (result.isErr()) return Err(result.unwrapErr())` or `match`.
- **Errors**: a `TaggedError` base in `platform/ddd/contracts/tagged-error.ts` — `class TodoNotFound extends TaggedError("TodoNotFound")<{ todoId: TodoId }> {}` gives `_tag`, the props, `message`. Domain errors are values in `Err`, never thrown. Defects throw.
- **Specifications** unchanged (`Spec.eq/isNull/and/or/not`, predicate + `criteria` AST); `criteriaToWhere` compiles to a slonik `sql.fragment`.
- **Events**: `Event.make("TodoCreated", z.object({...}))` from `@org/event-bus`, re-exported for the domain from `platform/ddd/contracts/domain-event.ts`. An event value is `{ _tag, ...payload }`.

### 3.2 `@org/database`

- `createDatabase({ url, ssl })` → `Database` with `pool`, `query`/`maybeOne`/`one`/`exec` helpers that resolve the **ambient transaction connection** (an `AsyncLocalStorage` the package owns) before every statement and fall back to the pool — automatic joining, no opt-in (ADR-0005/0007).
- `withTransaction(fn)` is depth-aware: outermost opens `pool.transaction`, nested opens a slonik savepoint (`tx.transaction`). `hasOpenTransaction()` answers the unit of work's `isActive`.
- Row decoding: `sql.type(RowSchema)` with a result-parser interceptor, so a row that does not match its zod schema is a defect. `RowSchemas.*` are zod objects mirroring the original.
- Error vocabulary: `DatabaseError { type: "unique_violation" | "foreign_key_violation" }` and `DatabaseUnavailable` mapped from slonik's error classes; everything else is a defect. Kept as the persistence vocabulary the ports translate to `PersistenceUnavailable`.
- Migrations: `migrations/NNNN_name.ts` exporting `{ up }` (knex raw DDL, schema-qualified, no downs — ADR-0011), registered in `migrations/index.ts` as a static `MigrationSource`; `runMigrations`, `resetAndMigrate` (drop `MODULE_SCHEMAS` + `knex_migrations`, replay), `MODULE_SCHEMAS`.

### 3.3 `@org/unit-of-work` (from scratch)

```
UnitOfWork.run<A>(fn: () => Promise<A>): Promise<A>
TransactionDriver { withTransaction(fn), withSavepoint(fn), isActive(): boolean }
DeferralSink { defer(events): void }          — installed alongside run
PersistenceUnavailable, TransactionFailed, EventDispatchedOutsideUnitOfWork
testing: makeRecordingDriver(), PassThroughUnitOfWork
```

- Scope carried in an `AsyncLocalStorage<{ deferred: Array<() => Promise<void>> }>`.
- Re-entrant: no active scope → outermost (`withTransaction`, then drain deferred **after** commit, uninterruptibly in order); active → nested (`withSavepoint`, truncate the deferred buffer back to entry length on failure).
- **Typed failure discards the unit of work.** If `fn` resolves to an `oxide.ts` `Result` that is `Err`, the scope rolls back and the `Err` is returned unchanged. A thrown error rolls back and rethrows. This is the Promise-world equivalent of Effect's failure channel aborting the transaction.
- `TransactionFailed` (commit rejected) is a defect at the boundary; `PersistenceUnavailable` propagates as `Err`.
- The sink resolves the bus at defer time and buffers a closed-over drain (bus wired deeper than the boundary is still the bus drained).

### 3.4 `@org/event-bus` (from scratch)

Same shape as `@effect-server-utils/cqrs`'s bus, Promise-based:

- `subscribe(Event, handler)` — immediate; runs in the publisher's async context (so inside its transaction); a rejection propagates out of `dispatch` and rolls the publisher back.
- `subscribeAfterCommit(Event, handler)` — deferred to the `DeferralSink` if one is attached (installed by the unit of work), else run at the end of the dispatch; each handler isolated, failures logged **and** reported to `UnhandledFailures`.
- `stream(tags)` — an async iterable fed by a broadcast, never awaited (saga substrate).
- `dispatch(events)` hands events to the sink **before** any immediate handler; no scope → `EventDispatchedOutsideUnitOfWork` (defect).
- `drain(events, boundary?)` runs after-commit handlers, each through `boundary` (the uow's `run`, so every reaction gets its own transaction).
- Span attribute extractors per event tag, applied to the `event.<tag>` span.
- `@nestjs/cqrs`'s own `EventBus`/`EventsHandler`/`Saga` are **not used**; the manifest refuses importing them anywhere (its publish is fire-and-forget and cannot express immediate consistency).

### 3.5 `@org/authz` (from scratch)

Identical public surface, Promise-based: `AuthzConfig` (caller, checkFailure, resourceMissing, action), `PolicyMap`, `ResourceResolverMap` (declaration-merged), `Check.any/all`, `ResourceCheck`/`UnscopedCheck`/`CallerCheck` returning `Promise<Result<boolean, CheckFailure>>`, `Resolver<R>` returning `Promise<Result<Resource, NotFound | CheckFailure>>`, `makePolicyRegistry`, `makeResourceResolverRegistry`, `makeHasPermissions({ forbidden })` returning `(caller, resource, action, ...id) => Promise<Result<void, Denied | CheckFailure | NotFound>>`. The server wraps it in `platform/auth/authz.ts` as a Nest-injectable `Authz` service that reads the caller from the request.

### 3.6 `@org/contracts` (zod + OpenAPI)

- Per-API-group modules (`TodosContract`, `UserContract`, …) declare zod DTO schemas and **route definitions** via a tiny `defineRoute({ method, path, operationId, params, query, body, responses })` helper that (a) registers the operation in a `zod-to-openapi` registry and (b) returns a typed handle the server and clients read.
- `pnpm -F @org/contracts openapi:generate` writes `openapi.json` (committed); a test fails when it is stale. `openapi-typescript` generates `generated/api.d.ts` (committed) for `openapi-fetch` clients.
- Error DTOs are tagged (`_tag` + `message` + fields) with a declared status; `HttpProblems` holds the generic 4xx/5xx set. Server maps domain `Err` → contract error at the endpoint.
- `Policy.ts` keeps `CurrentUser` as a plain type `{ sessionId, userId }`.
- Dates cross the wire as ISO strings (`z.iso.datetime()`); the server formats, the web parses where it needs a `Date`.

### 3.7 NestJS server

- **Composition**: `AppModule` imports `CqrsModule.forRoot()`, `DatabaseModule`, `DddModule` (event bus + unit of work + unhandled failures), `AuthzModule` (registries folded from module contributions), and every feature's Nest module. Each feature `<feature>.module.ts` is a `@Module` whose `providers` are its handlers, repositories (live), ACL adapters, policies contribution, resolver entries; `controllers` are its endpoints; `imports` are the peer feature modules it reaches (ADR-0032: a module states its imports by importing them) and `exports` what a peer resolves.
- **Commands/queries** are `@nestjs/cqrs` `Command<Result<A, E>>` / `Query<Result<A, E>>` subclasses whose constructor takes the zod-parsed payload; handlers are `@CommandHandler(X) class XHandler implements ICommandHandler`. Result type inference gives the typed channel `bus.execute(cmd)` returns. A per-module unit test asserts each declared message has exactly one handler (boot completeness).
- **Unit of work** is explicit in the handler: `return this.unitOfWork.run(async () => { … })`.
- **Endpoints**: one controller class per `*.endpoint.ts` (`@Controller("orgs") class CreateTodoEndpoint { @Post(":orgId/todos") … }`), zod validation pipe from the contract schemas, `@Caller()` param decorator, `UserAuthGuard`, `mapDomainError` helpers turning `Err` into contract errors, `recoverPersistenceUnavailable` → 503. `interface/http/index.ts` lists the module's endpoint classes.
- **Auth**: `UserAuthGuard` (bearer API token or signed session cookie) via QueryBus/CommandBus, exactly the middleware's logic. `OidcClient` over `openid-client`. Cookie codec HMAC.
- **Tracing**: OTel node SDK preloaded; `platform/cqrs/` provides `AppCommandBus`/`AppQueryBus` wrappers that open `command.<Tag>` / `query.<Tag>` spans with the module's span attributes, so use-case granularity spans survive (ADR-0012).
- **Peer surfaces**: `<feature>.exports.ts` publishes `<module>Access<Queries|Commands|DomainEvents|Errors>` objects holding the message classes/events/errors a peer may name; `<feature>.imports.ts` re-exports what this module takes. ACL adapters and event adapters read only their own module's imports file.
- **Test seams**: `RecordingEventBus`, `PassThroughUnitOfWork`, repository fakes (`Map`-backed), handler unit tests construct handlers directly (no DI container). Integration/endpoint tests boot the app through `Test.createTestingModule` with the fake auth guard and fake billing gateway, listen on an ephemeral port, and drive it with the contracts' `openapi-fetch` client (`useServerTestRuntime`).

### 3.8 Web (Next 16 + TanStack Query)

MVVM survives with the arrow unchanged: **View → ViewModel → Model**.

- Model = `services/`: `api-client.shared.ts` (openapi-fetch over `/api`), `query/query-keys.ts` (the invalidation vocabulary — replaces reactivity keys), `data-access/<feature>.queries.ts` (`queryOptions()` factories + mutation functions), `<feature>.server.ts` (`prefetch*` for RSC hydration), `notifications`/`navigation` contexts whose bridges live at the app edge (sonner / next router) and whose test doubles record.
- ViewModel = `*.view-model.ts`: custom hooks over `useQuery`/`useMutation`/`useState` returning plain view state + actions. May import react and react-query; may not import a View or `@org/components`. Tested with `renderHook` under `QueryClientProvider` + recording bridges + MSW.
- View = `*.view.tsx`: renders its ViewModel's output; may call only its own ViewModel hooks plus `useId`/`useCallback`; no `useState`/`useEffect`/`useQuery`.
- Hydration: RSC pages `prefetchQuery` into a per-request `QueryClient` and wrap children in `HydrationBoundary`.

### 3.9 Architecture enforcement

goodbones stays (`@goodbones/*` at the same exact beta). The manifest is rewritten so every
tier's `external` names the new libraries (`zod`, `oxide.ts`, `@nestjs/common`, `@nestjs/cqrs`,
`slonik`, `@org/unit-of-work`, …), the `exports` restrictions fence `makeEventBus`,
`makeUnitOfWork`, `makeUnhandledFailures`, `makePolicyRegistry`, `makeResourceResolverRegistry`
and `CqrsModule` to composition roots, and refuse `EventBus`/`EventsHandler`/`Saga` from
`@nestjs/cqrs` everywhere. `lint:rules`, `lint:edges`, `lint:conformance`, coverage floors and
the baseline ratchet all carry over. Effect-only gates (`check:effect`, `effect:source`) are gone.

## 4. Deviations worth naming

- Handlers return `Result` values; the unit of work rolls back on `Err` (see 3.3). A thrown error is a defect.
- No fiber interruption: a client hanging up does not abort a command. `deadline` middleware is not ported.
- Per-module dispatch surfaces (`Command.subsetOf`) become import-rule + naming discipline: `@nestjs/cqrs` has one bus; the peer surface publishes the message _classes_ a peer may construct, and the manifest holds the consumer to reaching them only through `<feature>.imports.ts`.
- `sagas/` is declared in the taxonomy but, as in the original, holds no saga.
- Storybook and the component library are copied, not redesigned.

## 5. Phases

0. **Plan** (this document). ✅
1. **Scaffold**: pnpm workspace, root tsconfig/oxlint/prettier/vitest/husky, docker-compose + infra, `.env.example`, CI workflows, empty `architecture.yaml` tree.
2. **Kernel packages**: `contracts` (all groups + openapi generation + generated client types), `database` (slonik kernel + all 22 migrations under knex + row schemas + tests), `event-bus`, `unit-of-work`, `authz` — each with unit tests.
3. **Server platform + exemplar modules**: env, database module, ddd runtime, cqrs wrappers, auth kernel (cookie codec, guard, authz), notifications (mailer port + log/smtp/ses), http kernel (zod pipe, problem filter, caller decorator), test-utils; then `role`, `user`, `todos` end-to-end with unit + integration + endpoint tests.
4. **Remaining modules** in parallel: `organization`, `wallet`, `auth` (OIDC + sessions + api tokens + device grants + CLI endpoints), `billing` (Stripe live + fake).
5. **Clients**: `web` (all features, tests, MSW handlers), `components`, `api-client`, `cli`, `mcp`, `jobs`, `acceptance`, `test-drivers`.
6. **Enforcement + docs**: full manifest, probes, edges table, conformance ceilings, coverage floors; ADRs re-authored; `.claude/rules/*`, `CLAUDE.md`, README. `pnpm check:all` green.

Each phase ends with typecheck + lint + unit tests green for what exists; integration tests run
against a local Postgres (`DATABASE_URL_TEST`) when available.

## 6. Status (2026-09-14)

| Phase                         | State                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Scaffold                    | Done.                                                                                                                                      |
| 2 Kernel packages             | Done; unit + integration tests green.                                                                                                      |
| 3 Platform + exemplar modules | Done. `AuthzModule` and `CqrsRuntimeModule` are `@Global()`; the guard reaches auth through the `Authenticator` port (see ADR-0033).       |
| 4 Remaining modules           | Done: organization, wallet, auth, billing, each with repository, query and endpoint integration tests.                                     |
| 5 Clients                     | Done: web (TanStack Query MVVM, builds), components (effect-free, Storybook builds), api-client, cli, mcp, jobs, acceptance, test-drivers. |
| 6 Enforcement + docs          | Manifests, probes, edges, ADRs and rules written; see `CLAUDE.md` for the gate commands.                                                   |

Verified locally: `pnpm check`, the unit suite (446 tests), the server integration suite (232
tests), the merged coverage run (690 tests; floors recorded in `vitest.config.ts`), the Next
build, the Storybook build, and a real server boot (`/auth/me` → 401, `/openapi.json` → 200,
`/cli/device/start` → 201). Not run here: the Playwright acceptance suite (needs the Zitadel
compose stack) and the MCP server against a live client.

Deviations discovered while porting, beyond §4: the web's wire types are the generated OpenAPI
`components` (ids are plain strings on the wire; the zod contract types stay branded), and
`unwrapOrThrow`'s `HttpProblem` hook re-translates only a resolver's `NotFound`, never a denial.
