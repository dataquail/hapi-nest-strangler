# ADR-0019: FE integration test seam is at the network boundary

- Status: Accepted
- Amended: 2026-08-21 — the tier below the integration seam is the ViewModel test. The seam itself is unchanged.
- Date: 2026-05-14
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

The template has ViewModel and View tests for client-side logic (ADR-0026) and Playwright acceptance tests for cross-process flows (ADR-0009). Neither covers a third, valuable tier: **page-level integration tests** that render a real feature composition against a fake API, exercise the full View + ViewModel + Model + cache invalidation + suspense stack, and assert on user-visible behaviour. ViewModel tests exercise one tier in isolation; acceptance tests are too slow and too coarse to drive negative-path coverage at the page level. The integration tier sits between them.

The question this ADR settles: **what's the seam where the fake replaces the real API?**

The forces:

- The contract is a set of zod route definitions in `@org/contracts`, from which `openapi.json` and the `paths` types are generated (ADR-0010). The production client is `openapi-fetch` over those types. Server endpoints and the FE client derive their request/response shapes and tagged error unions from this single source.
- The FE's client already accepts a swappable transport — `configureApiTransport` in `services/api/transport.shared.ts` sets the base URL and headers the client factory reads.
- Auth is BFF-style (ADR-0016–0018): the Nest server holds the session cookie. The FE never sees tokens directly.
- A prior plan tried to fake the entire backend in-process by running the real handlers against a `FakeDatabase`. It collapsed under the cost of simulating Postgres semantics. Once any test depended on a fake-only behaviour, the fake's fidelity became part of the production contract by accident.

## Decision

**The FE integration tier's fake is at the network boundary, intercepted by MSW (Mock Service Worker).** Tests compose per-scenario handlers from per-feature builders and per-domain fixtures. Handlers are stateless and order-independent; cross-endpoint side effects are not modelled.

Three sub-decisions lock the shape:

### 1. Per-test handlers, not a stateful fake

Each test calls `server.use(...handlers)` with the exact responses its scenario needs. There is no shared in-memory model that survives across handler calls within a test. If a scenario needs "POST /users then GET /users returns the new user," that's expressed by registering the second list handler after the first load — MSW resolves the most recently registered handler first.

Rationale: every experience report on stateful MSW fakes reaches the same regret — the fake becomes a parallel implementation of the backend, and drift between fake and real becomes silent test rot.

### 2. Typed handlers derived from `@org/contracts`

`typedHandler(UserContract.Group.routes.find, resolver)` (`test/typed-handler.ts`) sits between MSW's `http.get/post/put/delete` and test code. It reads the method and path off the route definition, decodes the path params, query and body through the route's own zod schemas, and hands the resolver `{ path, urlParams, payload }`. The resolver replies with `ok(value)` — the route's success value — or `fail(definition, body)`, one of the route's declared errors encoded the way the server's problem filter writes it. Contract drift becomes a `tsc` error, not a runtime test failure.

The wrapper is not codegen. It is one short function over the same route definitions the server binds (ADR-0013).

### 3. Per-feature handler builders + per-domain fixtures

- **Fixtures** (`packages/web/test/fixtures/<entity>.ts`) — `makeUser({ overrides? })` produces a contract-shape object with sensible defaults. Each fixture has a co-located test that parses its default output through the contract's response schema. That parse test is the drift gate.
- **Handler builders** (`packages/web/test/handlers/<feature>.ts`) — `usersHandlers.list(users)`, `usersHandlers.create({ result: "UserAlreadyExistsError" })` — take a scenario outcome and return an MSW handler. Tests compose handlers; they don't write them.

Tests look like:

```ts
server.use(
  handlers.auth.signedInAs(),
  handlers.users.list([]),
  handlers.users.create({ result: "success" }),
);
```

`server.listen({ onUnhandledRequest: "error" })` is non-negotiable: every test must declare every endpoint it touches. The default handler set 401s `/auth/me` and nothing else.

## Alternatives Considered

### A. In-process backend over `FakeDatabase`

Rejected: faking Postgres semantics is a tar pit, FE test code would import backend modules, and the integration and acceptance tiers would overlap in fidelity.

### B. Booting the real Nest application in the test process

`Test.createTestingModule` can boot the server against the test database, and the server's own endpoint tests do exactly that (ADR-0009). Rejected here: it couples the FE suite to Postgres, entangles the two packages' release cadences, and re-proves what the server's endpoint tests already prove.

### C. Mocked client shape (`{ GET: vi.fn() }`)

Rejected: the canonical mockist anti-pattern. Tests assert implementation (which client method was called) instead of behaviour (what the user sees).

## Consequences

**The integration tier doesn't extend to Playwright.** MSW handlers live in the test process; Playwright drives a browser against a real Next + Nest deployment. Cross-process flows test at the acceptance tier instead. Tier sharing happens through the page driver (`@org/test-drivers`); state setup is allowed to diverge between tiers.

**Cross-endpoint flows test twice.** "Create user, see user in list" is tested at the integration tier with per-call handler responses, and at the acceptance tier against the real backend. Each proves something different.

**No restriction on backend runtime.** The MSW seam has no shared-runtime requirement. A module rewritten in another runtime is unaffected.

**Test files live at `packages/web/features/<feature>/__tests__/*.integration.test.tsx`.** Sibling to feature code, separate from the per-tier tests. The suffix mirrors the server-side convention from ADR-0009.

**Shared infrastructure lives at `packages/web/test/`** — the MSW server and lifecycle, the typed handler, fixtures, handler builders, and two harnesses: `query-harness.tsx` (`renderViewModel` over a fresh `QueryClient`, `renderView`) and `integration-harness.tsx` (`renderWithHarness`: theme → `QueryClientProvider` → the notification bridge → `<Toaster />`, deliberately without the navigation bridge, which holds the Next router).

## Supersedes / differs from the Effect edition

`typedHandler` reads a zod route definition rather than an `HttpApi` endpoint, and resolvers return plain `ok`/`fail` values rather than Effects; the harness mounts a `QueryClientProvider` rather than an `AtomRegistry`. The seam, the statelessness rule and the fixture/builder split are unchanged.

## What this ADR does not change

- **ADR-0009 (testing pyramid).** The integration tier is additive.
- **ADR-0026 (MVVM).** ViewModels and Views are tested as before; the integration tier exercises them in composition.
- **ADR-0017, ADR-0018 (auth and renderer).** In the integration tier the cookie is irrelevant — MSW intercepts before the cookie matters.
- **The contract (`@org/contracts`).** The integration tier consumes it through `typedHandler`; the production client consumes it through the generated `paths`. Same routes.
