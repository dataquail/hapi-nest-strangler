# ADR-0013: HTTP endpoint file conventions and test parity

- Status: Accepted
- Date: 2026-04-25
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

ADR-0010 establishes that the server binds contract routes in `modules/<feature>/interface/http/`. It does not say _how_ those bindings are organized within the folder. The Nest idiom — one `@Controller()` class per resource with a method per route, each body inlined — works for two or three routes and decays from there. A `UserController` with four routes already runs to 100 lines with no clear "what implements `user.find`?" answer beyond scrolling.

The forces:

- A file's length should track the size of its single responsibility. A file responsible for "implement one endpoint" is short; a file responsible for "implement every user endpoint" grows monotonically.
- Finding the implementation of a named endpoint should be a filename match, not a search inside a long file.
- The contract is the source of truth for endpoint shapes. Server-binding code should not restate the method, the path or the success status — when the contract changes them, the binding should follow.
- Per-endpoint testing is the natural granularity for HTTP integration tests.
- "Every endpoint has a test" is a property the architecture should enforce, not a convention people remember.

## Decision

### One file, one controller class, per endpoint

Each route declared in a contract group has its own file in `modules/<feature>/interface/http/`, named `<endpoint>.endpoint.ts`. The file exports a single `@Controller()` class named `<Endpoint>Endpoint` with exactly one routed method. Naming uses the endpoint name from the contract verbatim (`find`, `create`, `delete`, `changeRole` → `find.endpoint.ts`, `change-role.endpoint.ts` after kebab-casing), so "what implements `user.find`?" is mechanical to find. A Nest controller is only a class the router scans for decorated methods; nothing requires one class per resource.

### "Endpoint", not "controller" or "handler"

The class is an _endpoint_, matching the route it implements in the contract. "Controller" is Nest's name for the container, and "handler" is the command/query stereotype (ADR-0024). The contract names routes; the implementation files do too.

### The route definition drives the binding

`Endpoint(route)` (`platform/http/endpoint.ts`) is one decorator that reads the method, the path and the success status off the contract's `RouteDefinition` and applies Nest's `@Get`/`@Post`/…, and `@HttpCode` for it, so a binding cannot drift from the OpenAPI document it implements. Inputs arrive through `zodPipe(route.params | route.query | route.body)` on `@Param`/`@Query`/`@Body`, which parses against the contract's own schema and answers a mismatch with a 400 `BadRequest` problem. The caller arrives through `@Caller()`, populated by `UserAuthGuard` (ADR-0016).

```ts
const route = TodosContract.Group.routes.create;

@Controller()
@UseGuards(UserAuthGuard)
export class CreateTodoEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async create(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<TodosContract.Todo> { ... }
}
```

The method's return type is the contract's response type, so a changed response shape is a compile error in the endpoint file, not a runtime mismatch.

### Group registration is pure wiring, in `index.ts`

The folder's `index.ts` lists the endpoint classes; the module's `<feature>.module.ts` spreads that list into `controllers`:

```ts
// modules/todos/interface/http/index.ts
export const todosEndpoints = [
  GetTodosEndpoint,
  CreateTodoEndpoint,
  UpdateTodoEndpoint,
  DeleteTodoEndpoint,
] as const;
```

No deconstruction, no logic. Adding an endpoint is a one-line change here plus a new endpoint file.

### Test parity is enforced by the manifest

Each `<endpoint>.endpoint.ts` must have a sibling `<endpoint>.endpoint.integration.test.ts`. This is one `requires` obligation on the endpoint node in `packages/server/architecture.yaml`, evaluated by `architecture/structure` under `pnpm lint` (ADR-0008, ADR-0028), which resolves the sibling against the real filesystem.

Endpoints carry **one canonical requirement**: `*.endpoint.integration.test.ts`, which exercises the real HTTP layer against a live database via `useServerTestRuntime(...)`. Two exceptions, encoded as `requiresNot` on the named nodes:

- The OIDC `login` and `logout` endpoints are **exempted** — their happy path needs a live identity provider and is covered by Playwright + the session-repository integration tests.
- `callback` has a real `callback.endpoint.integration.test.ts` for its reachable no-cookie guard.

A file ending `*.endpoint.test.ts` (no `integration`) is a deliberate unit token whose meaningful coverage lives elsewhere; it must carry a header comment naming where. If such a test starts hitting real HTTP + DB, rename it to `.endpoint.integration.test.ts`.

### Tests own their HTTP setup via a shared helper

Each per-endpoint test file uses `useServerTestRuntime(["todos.todos", …])` from `test-utils/`, which boots the application through `Test.createTestingModule`, listens on an ephemeral port, wires `beforeAll`/`afterAll` and per-test truncate, and hands back an `openapi-fetch` client typed by the contract's generated `paths`. Integration tests do _not_ import endpoint files directly; they exercise the contract over the wire, which is what the parity rule guarantees a test exists for.

## Consequences

- Endpoint files are short. Each does one thing. Reviewing a change to the user-create flow means reading one file.
- The `index.ts` registration stays small as a module's endpoint count grows — purely declarative, one name per binding.
- Adding an endpoint is a four-step change: add the contract route, create `<name>.endpoint.ts`, create `<name>.endpoint.integration.test.ts`, register in `index.ts`. `pnpm lint` fails if the test file is omitted.
- The contract drives the binding. A changed method, path, status, input or response shape surfaces as a TypeScript error in the endpoint file, not at runtime.
- The naming `<name>.endpoint.ts` / `<name>.endpoint.integration.test.ts` is mechanical and is the parity detector; renames must keep the suffixes in lockstep.

## Supersedes / differs from the Effect edition

`HttpApiBuilder.group(...).handle(name, endpointFn)` → a `@Controller()` class per endpoint and a list of classes in `index.ts`; the `EndpointRequest<Group, Name>` envelope type → `zodPipe` on Nest's parameter decorators, typed from the route's own schemas; the `Effect.fn("<GroupLive.op>")` boundary span → the HTTP auto-instrumentation's span (ADR-0012). The one-file-per-endpoint rule and the parity obligation are unchanged.

## Alternatives considered

- **One controller class per resource with all routes inlined (the Nest default).** Rejected because file length grows monotonically with route count and "what implements X?" becomes a search inside a wall of code.
- **Hand-written `@Post("orgs/:orgId/todos")` and `@HttpCode(201)` per method.** Rejected — restates the contract, and drifts from it silently.
- **A global `ValidationPipe` with class-validator DTOs.** Rejected — a second schema language beside the contract's zod, and a second place a payload shape can be wrong.
- **"Handler" as the file/class name.** Rejected — the contract calls these endpoints; `handler` is taken by the use-case stereotype.
- **Enforce parity via an import rule.** Rejected — "this file must exist" is not expressible as an edge; the integration tests go over the wire, so reachability isn't the right property. `architecture/structure` is the right tool.

## Related

- ADR-0008 (architecture enforcement) — the manifest that carries the parity obligation.
- ADR-0009 (testing pyramid) — the per-endpoint integration test is the HTTP E2E test described there.
- ADR-0010 (HTTP-only contracts) — the contract shape these endpoint files implement.
- ADR-0024 (dot-delimited filenames) — the `.endpoint` / `.endpoint.integration.test` naming.
