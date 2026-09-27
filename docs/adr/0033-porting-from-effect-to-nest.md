# ADR-0033: Porting the Effect edition to NestJS

- Status: Accepted
- Date: 2026-09-13

## Context and Problem Statement

`functional-domain-driven-hexagon` is a reference application whose architecture — functional core, imperative shell, DDD modules, one event bus inside a unit of work, a per-route authorization DSL, a manifest-enforced file taxonomy — was written on Effect v4. The question this repository answers is which of those decisions were about the architecture and which were about Effect. The port keeps every decision of the first kind, replaces every mechanism of the second, and records where the replacement forced a change of shape.

The plan that preceded the code is `docs/plan/nest-port-plan.md`. ADR-0001 through ADR-0032 were re-authored against the finished code, each carrying the line `Re-authored for the Nest edition: 2026-09-13 (ADR-0033)` and, where a decision changed materially, a "differs from the Effect edition" section. This ADR is the index of those differences.

## Decision

### What was kept

- Functional core over `Result`; the shell orchestrates and the domain never names a framework, a database or a bus (ADR-0001).
- The module layout, the stereotype folders, the dot-delimited filenames, the container-folder rule and the closed module root (ADR-0002, 0008, 0023, 0024).
- Aggregates as data plus pure `XRootOps` bags returning `Result<Outcome, DomainError>`; domain events declared beside the aggregate (ADR-0003).
- Tagged errors with a `_tag` discriminant, domain errors in `domain/`, contract errors in `@org/contracts` (ADR-0004).
- Repository ports with a live, a fake and a mapper, specifications compiled to SQL (ADR-0005).
- A typed command/query bus with span-per-message, boot-time handler coverage, and messages that carry their result type (ADR-0006).
- One unit of work, one domain event bus, `subscribe` / `subscribeAfterCommit` / `stream`, deferral into the ambient scope, rollback of the whole use case on failure (ADR-0007).
- The testing pyramid, the two disjoint suites, the merged coverage ratchet (ADR-0009).
- HTTP-only contracts, per-module schemas, the migration strategy, Zitadel as a server-side BFF, the frontend auth flow and the Next renderer over `/api` (ADR-0010, 0011, 0016–0018, 0020).
- Per-route authorization: `Check.any/all`, resource resolvers, policy contributions folded into one registry (ADR-0021).
- Cross-module ports tiered by counterpart, `<feature>.exports.ts` / `<feature>.imports.ts`, modules that state their own imports (ADR-0022, 0032).
- oxlint, the goodbones manifest, the engine as a dependency, YAML per package, the probes, the edge table, the conformance ceilings (ADR-0025, 0027–0031).
- MVVM on the frontend with a one-way dependency arrow and a deny-by-default feature taxonomy (ADR-0026).

### What was replaced

| Effect concept                                       | Nest edition                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `effect/Result`                                      | `oxide.ts` `Result`, `Ok`, `Err`                                                                                                       |
| `Schema.TaggedErrorClass`                            | `TaggedError("X")<Props>` factory (`platform/ddd/contracts/tagged-error.ts`), extended by a class                                      |
| `Schema.Class` aggregates and value objects          | zod schemas + inferred types; `z.guid()` branded ids                                                                                   |
| `Context.Service` + `Layer`                          | Nest providers; DI tokens are abstract classes, `@Inject(Token)` everywhere                                                            |
| `Command.make` / `Query.make` + `Command.dispatcher` | `class XCommand extends Command<XResult>` + `@CommandHandler` classes; `AppCommandBus` / `AppQueryBus` wrap Nest's buses with spans    |
| `@effect-server-utils/cqrs` event bus                | `@org/event-bus` (workspace package, written from scratch to the same three delivery contracts)                                        |
| `@effect-server-utils/unit-of-work`                  | `@org/unit-of-work` (workspace); `withUnitOfWork` → `this.unitOfWork.run<XResult>(…)`                                                  |
| `@effect-server-utils/authz`                         | `@org/authz` (workspace), Promise-native, `AuthzConfig` augmentation for the host types                                                |
| `effect/unstable/httpapi`                            | `@org/contracts` `defineRoute` / `defineGroup` + OpenAPI document; Nest controllers via `@Endpoint(route)`, `zodPipe`, `unwrapOrThrow` |
| `HttpApiClient`                                      | `openapi-fetch` over generated `paths` (`openapi-typescript`), in web, CLI, MCP and the server's test client                           |
| `effect/unstable/sql` + `@effect/sql-pg`             | slonik behind `@org/database` `createDatabase`; `AsyncLocalStorage` ambient transaction; zod row schemas                               |
| `@effect/sql` migrator                               | knex programmatic migrator with a static `MigrationSource`; `knex_migrations` table                                                    |
| `Effect.fn("name")` spans                            | `@opentelemetry/api` spans opened by the buses, the event bus and the authorizer; handlers annotate the active span                    |
| `HttpApiMiddleware` auth                             | `UserAuthGuard` (`CanActivate`) over the `Authenticator` port; `@Caller()` parameter decorator                                         |
| `ManagedRuntime.make(TestServerLive)`                | `Test.createTestingModule({ imports: [AppModule] })` with token overrides                                                              |
| `@effect/atom-react`                                 | TanStack Query v5; ViewModels are hooks; `useApiMutation`; typed query keys                                                            |
| `@effect/language-service` gate                      | none — there is no framework diagnostics pass                                                                                          |
| `@effect/vitest`                                     | plain `vitest`                                                                                                                         |

### Deviations named in the plan (§4)

1. **Handlers return `Result`; the unit of work rolls back on `Err`.** Effect's failure channel is gone, so the unit of work inspects the returned value: an `Err` rolls the transaction back and discards deferred events; a thrown error is a defect and does the same. The consequence is the `XResult` alias on every message: TypeScript does not infer a union of `Ok<A> | Err<E1> | Err<E2>` from branches, so `run<XResult>` and the message's phantom type both name it explicitly.
2. **No fiber interruption.** A client hanging up does not abort a command. `Middleware.deadline` and cancellation are not ported; a slow handler runs to completion and its result is discarded by Express.
3. **Per-module dispatch surfaces become import discipline.** `@nestjs/cqrs` has one bus, so `Command.subsetOf` has no counterpart. The peer surface publishes the message classes a peer may construct, and the manifest holds a consumer to reaching them only through its own `<feature>.imports.ts` (ADR-0006, ADR-0032).
4. **`sagas/` is declared in the taxonomy and holds no saga**, as in the original.
5. **Storybook and the component library are copied, not redesigned.** `@org/components` lost its Effect imports and nothing else.

### Deviations found while porting

6. **The `Authenticator` port.** A guard named in `@UseGuards()` is evaluated when the controller class is decorated, at module-load time. `UserAuthGuard` originally imported the auth module's `auth.platform.ts` to reach the session and API-token queries; that module's endpoints import the guard; the ES-module cycle left `UserAuthGuard` as `undefined` at decoration time and Nest reported `Invalid guard passed to @UseGuards() (CreateUserEndpoint)`. The fix is structural: `platform/auth/authenticator.ts` is an abstract port the guard depends on, and `platform/middlewares/authenticator-live.ts` is the only file that names the auth module. The guard never imports a module (ADR-0016).
7. **The authz vocabulary is re-exported from `platform/auth/authz.ts`.** `oxlint-tsgolint` builds each file's program from its own import graph, so an `AuthzConfig` augmentation declared in a file the linted file does not import is invisible and every dependent type collapses to `never`. `tsc -b` was clean; the linter reported fifty `no-unsafe-*` findings in the policies. Policy files therefore import `Check`, `CheckFor`, `ResourceCheck`, `CallerCheck`, `Resolver` and `PolicyContribution` from `@/platform/auth/authz.js`, the file that carries the augmentation. A side-effect import does not carry it; only a binding does (ADR-0021, ADR-0025).
8. **`AuthzModule` and `CqrsRuntimeModule` are `@Global()`.** A provider registered in the root module is not visible to feature modules — Nest resolves only through explicit `imports`. Every endpoint names `UserAuthGuard` and `Authz`, and every handler names `UnitOfWork` or a bus, so both modules are global rather than imported seven times. `BillingGatewayModule` is global for the same reason on the one seam the test root overrides.
9. **Generated OpenAPI types are `.ts`, not `.d.ts`.** `tsc -b` does not copy a `.d.ts` source into `build/dts`, so a `.d.ts` file was unreachable from the built package. `src/generated/api.ts` contains only types, is generated by `pnpm -F @org/contracts generate`, and is imported through the `@org/contracts/generated/api` subpath.
10. **Web wire types come from the generated schemas.** A contract's zod-inferred type carries branded ids; the wire carries strings. `services/api/types.ts` exposes `Schemas = components["schemas"]`, and ViewModels name those (ADR-0026).
11. **`unwrapOrThrow` re-translates only a resolver's `NotFound`.** A resource resolver reports absence as a generic 404 problem; a route may wish to present its own error instead. The optional `HttpProblem` entry in a problem map receives only a raised problem whose tag is `NotFound`; every other raised problem — a denial — passes through untouched (ADR-0021).
12. **Turbopack needs a one-element `paths` mapping.** Next's bundler panics on a tsconfig path with several fallback targets, so web maps `@org/contracts` to the built package's ESM output and web's `predev`/`prebuild`/`pretypecheck` build contracts first (ADR-0018).

### Why Nest's own `EventBus` and `Saga` are not used

`@nestjs/cqrs`'s `EventBus.publish` pushes onto an RxJS subject and returns. A handler runs on a later tick, outside the publisher's `AsyncLocalStorage` scope, so its repository call takes a fresh pool connection outside the transaction, and it has no way to fail the publisher. That is neither of the two consistency models ADR-0007 offers: it cannot join the transaction (`subscribe`) and it cannot wait for the commit (`subscribeAfterCommit`). `@Saga` is the same subject with an operator on it. The manifest refuses `EventBus`, `EventsHandler`, `Saga`, `ofType`, `IEvent` and `IEventHandler` from `@nestjs/cqrs` everywhere, and refuses the namespace import that would carry them past the symbol list (ADR-0030). `CommandBus` and `QueryBus` from the same package are used, wrapped by `AppCommandBus` and `AppQueryBus` so that every dispatch is a span.

## Consequences

- The kernel is three workspace packages with no framework beneath them; ADR-0029 records why they are not installed.
- `pnpm check:all` has no `check:effect` step; the only type-level gate is `tsc -b` plus the type-aware linter.
- Three Nest behaviours shape file placement and are recorded in `.claude/rules/nest-cqrs-notes.md`: decoration-time evaluation of guards, module-scoped provider visibility, and the absence of `emitDecoratorMetadata` (so every injection names its token).
- Two linter behaviours shape the lint config: augmentation visibility through the import graph, and an autofixer that rewrites declaration merges to type aliases (ADR-0025).

## Alternatives considered

- **Nest's `EventBus` with a transactional wrapper.** Rejected: the wrapper would have to re-implement deferral, ordering and rollback on top of a fire-and-forget subject, which is the event bus the workspace package already is.
- **Keep Effect's `Result` via a compatibility shim.** Rejected: the whole point is a domain layer with one small dependency; `oxide.ts` is that dependency.
- **`emitDecoratorMetadata` to drop the `@Inject` tokens.** Rejected: the abstract-class tokens make injection explicit and greppable, and the flag ties the build to a TypeScript-only emit path.

## References

- `docs/plan/nest-port-plan.md` — the plan, including §4.
- ADR-0001 through ADR-0032, each re-authored against this code.
- `.claude/rules/nest-cqrs-notes.md` — the working-memory digest of the gotchas above.
