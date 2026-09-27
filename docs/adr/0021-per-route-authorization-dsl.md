# ADR-0021 — Per-route authorization DSL (PolicyRegistry + ResourceResolverRegistry)

- Status: Accepted
- Date: 2026-05-19
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context

The auth guard (ADR-0016) authenticates a request and attaches `CurrentUser` — `sessionId` plus `userId` — to it, but performs no authorization. Authentication alone leaves every endpoint with the same story: _"must be authenticated."_ Endpoints that introduce a real privilege distinction — promote / demote, org-admin-only surfaces — need a place to declare _who_ may invoke them. Two failure modes if we shipped without a DSL:

1. **Inline `if (!isSuperAdmin) …` in every endpoint.** Each endpoint reinvents authz; refactoring the rule requires touching every site.
2. **The future capability-ACL work would appear as a giant rewrite.**

### Prior art

Spring Security's `@PreAuthorize("hasPermission(#id, 'group', 'view')")` annotation, popularised in the Java ACL extension `jaclp`, captures the shape we want:

| Spring / jaclp                                      | This codebase                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `@PreAuthorize("hasPermission(#id, R, A)")`         | `await this.authz.hasPermissions(caller, R, A, id)` in the endpoint    |
| `PermissionsService` registering `(R, A, callback)` | `PolicyRegistry` typed map keyed by `(R, A)` pairs                     |
| `IResourceRepository.getResource(id)` per type      | `ResourceResolverRegistry` keyed by resource name                      |
| Spring injects the current user                     | `@Caller()` hands the endpoint the `CurrentUser` the guard attached    |
| Callback signature `(UserDetails, ResourceObject)`  | Callback signature `(caller, resource) => Promise<Result<boolean, E>>` |

Nest's own answer is a `CanActivate` guard per rule or `@nestjs/casl`. Neither gives a registry keyed by `(resource, action)` with a resolver step; a guard cannot see the loaded resource, and CASL defaults to session-baked abilities. A hand-rolled DSL is ~200 LOC, Promise-native, and folds in cleanly with the typed buses.

## Decision

### One method, jaclp-shaped

Endpoints call exactly one platform function:

```ts
unwrapOrThrow(
  await this.authz.hasPermissions(caller, TodoResource, Actions.Delete, { organizationId, todoId }),
  {
    PersistenceUnavailable: serviceUnavailable,
    HttpProblem: () => todoNotFound(params.id),
  },
);
```

- **Resource** is a name like `"todo"` keyed into `ResourceResolverMap`.
- **Action** is one of `Actions.{Create, Read, Update, Delete}` (`platform/auth/actions.ts`) — this application's declared vocabulary, which the DSL takes as given rather than defines.
- **id** is decided by the resource, not the action. The variadic-tuple type on the last arg gives `Expected 4 arguments, but got 3` if you forget it.

The result is a `Result<void, Forbidden | PersistenceUnavailable | NotFound>`; `unwrapOrThrow` (ADR-0004) throws the `Forbidden` and `NotFound` problems it already is, and the optional `HttpProblem` entry re-translates only a resolver's generic `NotFound` into the route's own error — a denial passes through as its 403.

### Scopedness is a property of the resource, not the action

A resource registered in `ResourceResolverMap` is **scoped** — every action on it requires an id, and its checks always receive the resolved resource. A resource absent from that map is **unscoped** — no action on it takes an id, and its checks only ever see the caller. A "create in this container" is a scoped action on the container resource (`todoCollection`, keyed by the organization id). A check can never be handed `undefined`.

A caller-only check is declared at the narrower one-parameter arity (`CallerCheck`), so one instance composes into both tiers.

### Resolver fallibility is declared, not assumed

A resource declares whether resolving it can report absence. An echo resolver with nothing to load — `todoCollection`, whose identity is the org id — declares `notFound: never`, which removes `NotFound` from every caller's channel. The transient-store signal (`PersistenceUnavailable`) rides in every resolver's channel unconditionally: authorization reads the store twice, and both reads face the same outage, so the status a caller sees must not depend on which read hit it.

### This application's actions are CRUD; business operations live in commands

Two endpoints that both UPDATE a user — promote and demote — share the same `(user, update)` policy entry. The bespoke distinction belongs in the command/aggregate. When two operations on the same `(resource, action)` need _different_ authz outcomes, the rule that distinguishes them is a _domain invariant_ and lives in the command as a tagged failure the endpoint translates.

### Two declaration-mergeable registries

- **`ResourceResolverMap`** maps a resource name → `{ idType, resourceType, notFound? }`. Each module declares its entries via TypeScript declaration merging in its `policies/*.resource-resolver(s).ts`.
- **`PolicyMap`** maps resource → action → check. Same declaration-merge pattern, in `policies/<feature>.policies.ts`.

Registration values can be a single check or `ReadonlyArray<Check>`; arrays are AND-composed at registration. For OR composition, wrap with `Check.any(...)`:

```ts
this.contribution = {
  todo: {
    read: Check.any(superAdmin, isMember),
    update: Check.any(superAdmin, isMember),
    delete: Check.any(superAdmin, isMember),
  },
  todoCollection: {
    create: Check.any(superAdmin, isMember),
    read: Check.any(superAdmin, isMember),
  },
};
```

### Checks return a boolean `Result`, not void + Forbidden

A check is `(caller, resource) => Promise<Result<boolean, CheckFailure>>`. The boolean shape lets checks compose via `any`/`all` before the final lift to `Forbidden` at the `hasPermissions` boundary.

### Registered checks are fully closed

A check takes its data source as an **argument** — a module's own ACL port (ADR-0022), or a lookup the contribution builds by dispatching the module's own policy query — and the module's contribution closes over it. The contribution is an `@Injectable()` class (`TodoPolicyContribution`) whose constructor receives the ports through `@Inject` and exposes the closed map as `contribution`; the resolvers are `@Injectable()` entries (`TodoResolverEntry`) exposing `resolve`. Every registered check therefore has no ambient dependency, and a policy unit test passes a function.

### Resolver loads the resource per request, not at session start

When a scoped action is invoked with an id, the framework calls the registered resolver, hands the loaded resource to the check, and returns `NotFound` for the endpoint to translate. No caching. A permission granted a moment ago is visible immediately.

The resolver reads a **read model**, never an aggregate: it dispatches the module's own query on `AppQueryBus`. Reads join the caller's ambient transaction (ADR-0005), so this is only immediate while the read path stays synchronous and same-database. **A query backing an authorization decision must never be served from a replica or a projection.**

### Shipped as a standalone workspace package

The DSL is `@org/authz`, framework-free and Promise-native: `Check.any/all`, `ResourceCheck`/`UnscopedCheck`/`CallerCheck`, `Resolver<R>`, `makePolicyRegistry`, `makeResourceResolverRegistry`, `makeHasPermissions({ policies, resolvers, forbidden })`. What the split forces into the open is everything the DSL is written against but does not own: the caller identity, what a check may fail with, how a resolver reports absence, the action vocabulary, and the error a denial becomes. The first four arrive as one augmented interface — `AuthzConfig`, declared once in `platform/auth/authz.ts` — and the fifth as the `forbidden` constructor `Authz` passes when it builds `hasPermissions`.

**Where the augmentation is visible.** A host's type-level configuration has to be present in every TypeScript program that names a check. `tsc -b` sees it because the server project includes `platform/auth/authz.ts`; the type-aware linter builds a program from each file's own import graph and does not. So `platform/auth/authz.ts` re-publishes the policy vocabulary — `Check`, `CheckFor`, `ResourceCheck`, `CallerCheck`, `Resolver`, `PolicyContribution` — and a module's policies import it from there, never from `@org/authz` directly. That one import is what carries the augmentation into the file (ADR-0033).

### Wiring respects the composition-root rule

`platform/modules/authz.module.ts` is a `@Global()` Nest module that imports every module with policies, injects their contributions and resolver entries, builds the two registries with `makePolicyRegistry` / `makeResourceResolverRegistry`, and provides `Authz`. It is global because every endpoint names `Authz`, and a root-module provider is not visible to feature modules. The two factories are fenced to composition roots by the manifest's `exports` rule, so nothing else can build a registry that answers with a different module's check.

## Consequences

### Positive

- One mechanism, one shape. Every endpoint that needs authz reads the same.
- Per-request resource resolution gives multi-context access changes immediately.
- Super-admin bypass is just another registered check composed via `Check.any`. Each module owns its own, asking the role module through its own ACL port, so no module carries a platform-level authorization dependency (ADR-0022).
- The `authz.hasPermissions.<resource>.<action>` span (ADR-0012) records every decision.

### Negative / trade-offs

- The CRUD-only vocabulary forces a layering decision: a rule that discriminates within UPDATE lives in the command, not the policy.
- The variadic-tuple type for the id is unusual; readers need a moment to recognise the required/forbidden semantics.
- `Forbidden` and `NotFound` must appear in the endpoint's contract error union; `Unauthorized` is added to every secured route automatically by the OpenAPI builder, since the guard raises it before the endpoint runs.

## Supersedes / differs from the Effect edition

`Effect<boolean, E, never>` checks → `Promise<Result<boolean, E>>`; the contribution `Layer` behind a `Tag` → an `@Injectable()` class exposing `contribution`; the composition root yielding Tags → `AuthzModule` injecting classes; `@effect-server-utils/authz` → `@org/authz`, written from scratch to the same design. The vocabulary re-export from `platform/auth/authz.ts` is new, and exists for the linter.

## Alternatives considered

- **CASL / `@nestjs/casl`.** Rejected for the session-baked default and the non-`Result` adapter surface.
- **One `CanActivate` guard per rule.** Rejected — a guard cannot see the resolved resource or compose with `any`/`all`, and the decision would sit in a decorator the reader has to find.
- **Casbin, Cerbos / Oso / Cedar.** Rejected as a second authoring surface or overkill.
- **Per-resource action enums.** Rejected for this application only — the vocabulary is a host declaration.

## Related

- ADR-0002, ADR-0006, ADR-0007, ADR-0008, ADR-0016, ADR-0022, ADR-0033.
