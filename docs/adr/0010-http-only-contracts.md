# ADR-0010: HTTP-only contracts, as zod schemas and a committed OpenAPI document

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

A use case can be exposed via many transports. Each adds adapter surface — validation, serialization, authentication, error mapping — and speculative adapters are never removed. This codebase is an HTTP server with a Next renderer, a CLI and an MCP server as clients, all over HTTP. Contracts must be shared between server and every client with a single source of truth for endpoint shapes, payloads, responses and error variants, and the use-case layer must not care which transport invoked it.

## Decision

This codebase exposes one transport: **HTTP**. Public contracts are declared in `@org/contracts` as zod schemas and route definitions, from which an OpenAPI 3.1 document is generated and committed. The contracts package has no server or database dependencies.

### Contract structure

```
contracts/src/api/
  UserContract.ts      — zod DTOs, `defineError` wire errors, a `defineGroup` of `defineRoute`s
  TodosContract.ts, OrganizationContract.ts, AuthContract.ts, BillingContract.ts, WalletContract.ts
  CliAuthContract.ts, CliTodosContract.ts, CliOrganizationContract.ts
  Contracts.ts         — barrel
contracts/src/DomainApi.ts, CliApi.ts  — the registered groups
contracts/src/openapi/document.ts      — buildOpenApiDocument()
contracts/openapi.json                 — committed; `pnpm contracts:generate` rewrites it
contracts/src/generated/api.d.ts       — openapi-typescript output; the `paths` type every client reads
```

A route is `defineRoute({ method, path: "/orgs/{orgId}/todos", operationId, params, query, body, success: { status, schema }, errors: [...], security: "session" | "public" })`. Every DTO schema carries `.meta({ id })` so it becomes a named OpenAPI component. Dates cross the wire as ISO strings (`z.iso.datetime()`); the server formats, the client parses where it needs a `Date`. A secured route implicitly declares `401 Unauthorized`, because the guard raises it before the endpoint runs.

### Server binding

Each module's `interface/http/` holds one `<name>.endpoint.ts` controller per route (ADR-0013). The `Endpoint(route)` decorator binds the controller method to the contract's method, Express path and success status, so an endpoint cannot drift from the document it implements; `zodPipe(route.params | route.body | route.query)` validates the inputs (a mismatch is a 400 `BadRequest`); the return type is the route's success schema's inferred type:

```ts
@Controller()
@UseGuards(UserAuthGuard)
export class CreateUserEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async create(@Body(zodPipe(route.body)) payload: z.infer<typeof route.body>): Promise<UserContract.CreateUserResponse> {
    const id = unwrapOrThrow(await this.commandBus.execute(new CreateUserCommand(payload)), { ... });
    return { id };
  }
}
```

`GET /openapi.json` serves the built document from `platform/http/openapi.controller.ts`.

### Client binding

Every client — the web's Model tier, `@org/api-client` for the CLI and MCP, the endpoint integration tests — is `openapi-fetch` typed by the generated `paths`: `client.POST("/orgs/{orgId}/todos", { params: { path: { orgId } }, body })`. A wrong path, a missing param or a body of the wrong shape is a compile error; the response is `{ data, error, response }` with `error._tag` narrowed to the route's declared errors.

### What is _not_ in this strategy

No GraphQL, no message-queue transport, no CLI as a product transport beyond the `/cli/*` HTTP group the CLI and MCP consume.

## Consequences

- Contracts are typed end-to-end. Type drift is a compile error in whichever package is updated last — and the committed `openapi.json` is diffable in review.
- The document is a real artifact: out-of-workspace consumers get it for free.
- A stale `openapi.json` is a test failure in `@org/contracts`, not a runtime surprise.
- The generation step (`pnpm contracts:generate`) is one more thing to run after changing a contract; the pre-commit hook and CI catch a forgotten run.

## Supersedes / differs from the Effect edition

`effect/unstable/httpapi` groups → `defineGroup`/`defineRoute` over zod; `HttpApiClient.make(Api)` → `openapi-fetch` over generated types; the "no OpenAPI, no codegen" position is reversed: the document is now the contract's published form, and the type generation is a build step with a committed output.

## Alternatives considered

- **Nest's `@nestjs/swagger` decorators on the controllers.** Rejected — the contract would live in the server, and the client would depend on a server-generated artifact rather than a shared package.
- **`nestjs-zod` DTO classes.** Rejected — the class is a server-side artifact; the zod schema is what both sides share.
- **A tRPC/ts-rest style RPC contract.** Considered; rejected because the CLI, MCP and acceptance tiers want a plain HTTP document, and the OpenAPI path is the industry-standard one.

## Related

- ADR-0004, ADR-0006, ADR-0008, ADR-0013.
