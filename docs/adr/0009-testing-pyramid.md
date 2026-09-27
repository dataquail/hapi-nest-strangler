# ADR-0009: Testing pyramid (four levels, two disjoint suites)

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

A testing strategy has to balance feedback speed, confidence, infrastructure cost, and cognitive load. Most tests should run in milliseconds with no auxiliary services; some need a real database to be meaningful; the boundary between the two should be visible from the filename; the tools that make use-case tests fast must be cheap to compose; and destructive operations must be impossible against a non-test database.

## Decision

Four test levels:

| Level                    | Location                                                                                                                                | Runtime                                                                       | DB  | Covers                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------- |
| Domain unit              | `domain/<subdomain>/*.root-ops.test.ts`, `*.specification.test.ts`, `domain-services/*.domain-service.test.ts`                          | none — plain function calls                                                   | no  | Pure ops, invariants, predicates                                                        |
| Use-case unit            | `commands/*.handler.test.ts`, `interface/events/*.event-adapter.test.ts`, `policies/*.test.ts`, `infrastructure/acl/*.acl-live.test.ts` | `new XHandler(fakeRepo, recordingBus, PassThroughUnitOfWork)` — no container  | no  | Command behavior, event emission, error paths                                           |
| Query / repo integration | `queries/*.handler.integration.test.ts`, `infrastructure/repositories/*.repository-live.integration.test.ts`                            | the live class over `createTestDatabase()`                                    | yes | Live SQL projections and mapping; constraint mapping; transaction joining               |
| HTTP E2E                 | `interface/{http,cli}/*.endpoint.integration.test.ts`                                                                                   | the real `AppModule` through `Test.createTestingModule`, on an ephemeral port | yes | End-to-end behavior including event subscribers, serialization, status codes (ADR-0013) |

### Handlers are constructed, not resolved

A Nest handler is a class with explicit `@Inject` constructor parameters, so a unit test constructs it directly — `new CreateUserHandler(new UserRepositoryFake(), makeRecordingEventBus(), PassThroughUnitOfWork)` — and calls `execute(new CreateUserCommand(payload))`. No `Test.createTestingModule`, no container, no decorator metadata. This is the property `experimentalDecorators` without `emitDecoratorMetadata` buys (ADR-0033).

### Two disjoint suites, selected by file suffix + the `TEST_INTEGRATION` toggle

Tests requiring a real database are suffixed `.integration.test.ts`. Selection lives in `vitest.shared.ts`:

- **`pnpm test`** runs the **unit** suite — every `*.test.ts` _except_ `*.integration.test.ts` — with no auxiliary services.
- **`pnpm test:integration`** sets `TEST_INTEGRATION=true` (scoped to `@org/server`, `@org/jobs`, `@org/database`) and runs **only** `*.integration.test.ts`.

Integration tests are **dumb — they do not self-skip.** The global setup asserts `DATABASE_URL_TEST` is set and that its name contains `test`, then replays the migrations; a missing or unreachable database aborts the run.

### Coverage: one merged number, gated in CI

Each suite emits a Vitest **blob** report; `pnpm coverage:merge` folds them into one report and checks the thresholds. Coverage configuration is root-only (`vitest.config.ts`), because a project config's `test.coverage` is ignored in workspace mode. Thresholds are a **ratchet**: raise a floor when coverage rises, never lower one. Exclusion is reserved for code no suite can reach — `main.ts`, `instrumentation.ts`, migration scripts, `server-only` modules, and in-memory fakes.

### Test database safety

The test infrastructure refuses to migrate or truncate any database whose name does not contain `test`. Migration replay is destructive (ADR-0011); the guard is the only defense.

### Test-only services

- **Recording event bus** — `makeRecordingEventBus()` from `@org/event-bus/testing`: records dispatched events, delivers to nothing, `byTag(Definition)` for assertions.
- **`PassThroughUnitOfWork`** — from `@org/unit-of-work/testing`: the real boundary over an in-memory driver, so a unit test sees the same re-entrancy, after-commit ordering and discard-on-`Err` production gets (ADR-0007).
- **In-memory fake repositories** — per aggregate, `extends` the abstract port, `Map`-backed, filter with the same specifications the live compiles (ADR-0005).
- **Fake ACL and client adapters** — `*.acl-fake.ts`, `*.client-fake.ts`, constructed with the answers a test wants.

### HTTP integration setup via a shared helper

`useServerTestRuntime(["schema.table", …], { caller?, seedSuperAdminCaller? })` from `test-utils/server-test-runtime.ts` boots the real `AppModule` once per describe block through `Test.createTestingModule`, overriding four things: `EnvVars` (test values), `Database` (the test pool), `Mailer` (a recording fake), and `UserAuthGuard` (a fake that attaches a fixed caller — `SUPER_ADMIN_CALLER` by default, `MEMBER_CALLER` on request); billing's gateway is the fifth once that module lands. It listens on an ephemeral port and returns `server()` with an `openapi-fetch` client typed by the generated `paths`, the database, both buses and the mailer. Tests exercise the contract (`client.POST("/orgs/{orgId}/todos", { params: { path }, body })`) and seed prior state by calling _other endpoints_, not by reaching into module internals. Query/repository integration tests seed via the live repository, not raw SQL, except for FK rows another module owns.

### What is _not_ in this strategy

No BDD/Gherkin, no committed load tests, no mutation tests, no client contract tests — the generated `paths` type is the contract test.

## Consequences

- The vast majority of tests run in milliseconds with nothing beyond `pnpm install`.
- The integration suite is deliberate, separate, and cannot be run by accident nor silently skipped.
- Fake-vs-live drift is mitigated by the shared abstract port (signature drift is a compile error) and by the fake and live tests exercising the same specifications.
- The endpoint integration tests are the only tests that prove transactional event dispatch end-to-end. Treat them as load-bearing.
- Handler unit tests are cheap enough that every command has one; the parity rule requires it.

## Supersedes / differs from the Effect edition

`@effect/vitest` → plain `vitest`; `it.effect` → `async` tests; `ManagedRuntime.make(TestServerLive)` → `Test.createTestingModule(AppModule)` with `overrideProvider`/`overrideGuard`; `HttpApiClient.make(Api)` → `openapi-fetch` over the generated types; the Effect layer graph → constructing handlers by hand.

## Alternatives considered

- **Resolving handlers through `Test.createTestingModule` in unit tests.** Rejected — a container per test is slower, and a handler whose dependencies are all explicit needs none.
- **All tests require a real database / all tests use fakes.** Rejected, both.
- **Integration tests that self-skip.** Rejected — a silent skip is a coverage regression that passes green.
- **A coverage threshold per suite.** Rejected — each suite is blind to what the other covers.
- **`supertest` against `app.getHttpServer()`.** Rejected — an untyped client; the `openapi-fetch` client makes a wrong path or body a compile error.

## Related

- ADR-0005, ADR-0007, ADR-0008, ADR-0013.
