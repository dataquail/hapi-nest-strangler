# ADR-0004: Errors as tagged classes carried in `Result`; defects throw

- Status: Accepted
- Date: 2026-04-24
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); slug was `errors-as-schema-tagged-error`

## Context and Problem Statement

Errors in TypeScript are conventionally thrown, which makes them invisible at the type level: a function's signature says nothing about what it can fail with. Nest's own idiom — throw an `HttpException` from anywhere and let a filter render it — is exactly that, and it lets a domain rule turn into a status code three layers before the boundary that should decide the status.

We need:

- A failure channel that is part of a use case's signature, so an endpoint that forgets to handle a new failure does not compile.
- HTTP responses with the right status codes for known error cases.
- Internal error renames not to leak to clients of the public API.
- A bright line between "this is a known business outcome" (user already exists) and "the system is in an unexpected state" (a database row failed to decode).

## Decision

### Domain errors

Domain errors are classes built from a tiny `TaggedError` factory in `platform/ddd/contracts/tagged-error.ts`, co-located with the aggregate they belong to. They are **values carried in `Err`**, never thrown, so the factory deliberately does not extend `Error`:

```ts
export class UserAlreadyExists extends TaggedError("UserAlreadyExists")<{
  readonly email: string;
}> {}
export class ApiTokenNotFound extends TaggedError("ApiTokenNotFound") {} // fieldless: new ApiTokenNotFound({})
```

`_tag` is what everything switches on; the props are the fields. The class must `extend` the factory result — `TaggedError("X")()` alone is not a class.

### The failure channel is `Result<A, E>`

A use case returns `Promise<Result<A, E>>` from `oxide.ts`, and its message class declares that exact type (ADR-0006): `type CreateUserResult = Result<UserId, UserAlreadyExists | PersistenceUnavailable>`. The bus hands it back untouched, so a dispatch site sees the union and the compiler holds it to it.

### Contract errors

HTTP-facing errors are _separate_ definitions in `@org/contracts`, built with `defineError(tag, status, shape, description)`: a tagged zod object plus the status the OpenAPI document and the response carry.

```ts
export const UserAlreadyExistsError = defineError(
  "UserAlreadyExistsError",
  409,
  { email: z.string(), message: z.string() },
  "...",
);
```

### Translation at the boundary

The endpoint maps every tag of the use case's `E` to a contract error, exhaustively, through `unwrapOrThrow` (`platform/http/endpoint.ts`):

```ts
const id = unwrapOrThrow(await this.commandBus.execute(new CreateUserCommand(payload)), {
  UserAlreadyExists: (e) =>
    problem(UserContract.UserAlreadyExistsError, {
      email: e.email,
      message: `A user with email ${e.email} already exists`,
    }),
  PersistenceUnavailable: serviceUnavailable,
});
```

The map's keys are the `E` union's tags, so adding a failure to a message fails to compile every endpoint that dispatches it until each one maps it. `problem(definition, body)` builds an `HttpProblem` — an `HttpException` carrying the definition and a `{ _tag, ...body }` payload — and `unwrapOrThrow` throws it; the global `ProblemFilter` writes it as JSON with the definition's status. A problem already raised on the way (a denial from `Authz`, a resolver's `NotFound`) passes through; the optional `HttpProblem` entry re-translates only a resolver's generic `NotFound` into the route's own error.

### Defects

Defects (a row that fails its schema, a constraint violation nobody mapped, a programmer bug) are **thrown**. They are not in `E`; the exhaustive map is not asked to handle them. `ProblemFilter` renders anything that is not an `HttpProblem` as a 500 `InternalServerError` body and logs the cause. Nest's own exceptions (an unknown route, a rejected body) are rendered with the tag matching their status, so a client can always switch on `_tag`.

## Consequences

- `Ok`/`Err` wrap use-case return values, and every caller unwraps — this is the price of a typed channel in Promise-land. Handlers read as early returns of the `Err`; the unit of work rolls back on it (ADR-0007).
- Two error classes per error case (domain + contract). Accepted in exchange for not leaking internal types into the public API.
- HTTP serialization is one filter and one factory; no `@Catch` per error, no per-controller mapping.
- Exhaustive error handling at the boundary is checked by the type system.
- The distinction between domain errors (in `E`) and defects (thrown) forces a deliberate choice every time an error case is added.

## Supersedes / differs from the Effect edition

`Schema.TaggedErrorClass` → `TaggedError("X")<Props>`; the Effect error channel → `Result`'s `E`; `Effect.catchTag` at the endpoint → `unwrapOrThrow`'s tag map; `Effect.die` → `throw`; `HttpApiSchema.annotations({ status })` → `defineError(tag, status, ...)`. The bright line is the same: `Err` for outcomes, `throw` for defects.

## Alternatives considered

- **Throw domain errors and `@Catch` them per controller (the Nest idiom).** Rejected — loses static exhaustiveness and lets a domain decision become a status code anywhere.
- **Single shared error class hierarchy** for both domain and HTTP. Rejected — couples internal modeling to external API.
- **Convert all domain errors to defects, render at the boundary by `instanceof`.** Rejected — "what can this fail with" becomes undiscoverable.
- **Stringly-typed error codes** on a generic error type. Rejected — defeats exhaustive handling.
- **A `neverthrow`-style `ResultAsync` chain.** Rejected — `oxide.ts`'s `Result` is a plain value with `isOk`/`isErr`/`unwrap`, which reads as ordinary control flow in an `async` handler.

## Related

- ADR-0010 (HTTP-only contracts) defines where the contract errors live.
- ADR-0006 (typed bus) preserves the `E` union end-to-end through the bus.
