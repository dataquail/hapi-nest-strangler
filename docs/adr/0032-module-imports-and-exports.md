# ADR-0032: A module states its own imports and exports

- Status: Accepted
- Date: 2026-09-13
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

ADR-0022 gives a consumer module an outbound port and a single anti-corruption adapter for every cross-module call. What it does not say is how the adapter's dependency is _satisfied_, or who is allowed to know it exists.

In the Effect edition both answers were once "the composition root": two roots each folded the module layers together in a hand-computed order, the order was the only record of the module graph, and every dispatch surface a module built was resolvable by every other module. The decision that fixed it — a module provides what it reaches, and publishes only what a peer is granted — is the one this edition keeps. Nest happens to have the mechanism built in.

## Decision

**A module imports the modules it reaches**, naming their `<feature>.module.ts` directly in its own `@Module({ imports })`:

```ts
@Module({
  imports: [OrganizationModule, RoleModule],
  controllers: [...todosEndpoints, ...todosCliEndpoints],
  providers: [
    ...todoCommandHandlers,
    ...todoQueryHandlers,
    { provide: TodosRepository, useClass: TodosRepositoryLive },
    { provide: OrganizationAccess, useClass: OrganizationAccessLive },
    { provide: PlatformRoles, useClass: PlatformRolesLive },
    TodoPolicyContribution,
    TodoCollectionResolverEntry,
    TodoResolverEntry,
  ],
  exports: [TodoPolicyContribution, TodoCollectionResolverEntry, TodoResolverEntry],
})
export class TodosModule {}
```

Nest's `imports` is a private import — a provider role exports is visible to todos' providers and to nobody who imports todos — and `exports` is the re-export. There is nothing to invent: a module that forgets an import fails at bootstrap with `Nest can't resolve dependencies of …`, naming the provider and the module.

**There is therefore no order.** `AppModule` (`platform/modules/application-modules.ts`) lists every module once, in any order, and both composition roots — `main.ts` and `test-utils/test-server.ts` — build it verbatim. What differs between them is what the test root **overrides** on the testing module: the database, the mailer, the auth guard and billing's gateway.

### Each plane has one gateway in and one out, and they do not mix

- **The coupling plane** is `<feature>.exports.ts` (publishes) and `<feature>.imports.ts` (consumes): the message classes a peer may construct, the domain events it may subscribe to, the errors it must translate. A consumer's `infrastructure/acl/**` and `interface/events/**` read their own module's `<feature>.imports.ts`, never a foreign surface.
- **The wiring plane** is `<feature>.module.ts`: a Nest module, reachable only from another module's `<feature>.module.ts`, from its own `<feature>.platform.ts`, and from `platform/modules/`.
- **The platform surface** is `<feature>.platform.ts`: the module class plus what only the kernel needs — the message lists and span-attribute maps `CqrsRuntimeModule` folds, the policy contribution and resolver entries `AuthzModule` folds, and for billing the live/fake gateway pair. Reachable from `platform/**`, `test-utils/**` and tests; no module may name another's.

A Nest module class never appears on the coupling plane: needing one is a fact about assembly, not something a bounded context asks of another.

### What the peer surface declares

Every declaration is named `<module>Access<Queries|Commands|DomainEvents|Errors>` — `roleAccessQueries`, `userAccessCommands`, `organizationAccessDomainEvents`, `userAccessErrors` — held to that shape by `architecture/surface`. Domain events and published errors are collected into objects rather than re-exported loose. The surface may not re-export at all; a peer needing a type derives it from the published value.

`@nestjs/cqrs` has one bus, so the per-module dispatch narrowing the Effect edition did with `subsetOf` is done at the source and the edge instead: the peer surface publishes the message _classes_ a peer may construct, and a peer cannot dispatch a message it cannot import (ADR-0006). Hence `roleAccessQueries = { FindUserRolesQuery }` and nothing else: a message with no external consumer is not published.

### A service whose adapter differs between composition roots is the root's to provide

Billing's `BillingGateway` is the only one. `BillingGatewayModule` (`platform/modules/`, `@Global()`) provides the Stripe adapter; the test root overrides the token with the fake. The billing module lists neither; it depends on the abstract class and takes whichever the root provided.

### Registries nobody owns are folded by the platform

A module's policy contribution and resolver entries are providers it exports. `AuthzModule` (`@Global()`) imports the three modules with policies and folds their contributions into `PolicyRegistry` and `ResourceResolverRegistry` in two factories — the same shape as `CqrsRuntimeModule` folding span-attribute maps. Neither composition root names them; anything both roots agree on belongs in the assembly they share.

## Consequences

- The module graph lives in the modules, next to the ACL adapters that create the edges. Reading `todos.module.ts` tells you what todos depends on.
- Neither composition root states an order, so the two cannot disagree about one.
- Two cycles are visible where they used to be hidden: an ES-module cycle (`import/no-cycle`, `no-cycles`), and a Nest module cycle, which Nest reports at bootstrap unless one side is `forwardRef`. The manifest forbids `forwardRef`; a cycle is a design error.
- What nothing replaces: refusing an export no module consumes, at message granularity. `no-orphans` covers files; the conformance slack report covers allowances; the message granularity is a code-review question.

## Supersedes / differs from the Effect edition

`Layer.provide` → Nest `imports`; `Layer.provideMerge` → Nest `exports`; the three-field `{ layer, http, httpDeps }` record → one `@Module` (controllers are providers-with-routes, so the three depths the Effect pipeline needed collapse); `Command.subsetOf` → publishing message classes; the two registries riding `httpDeps` → `AuthzModule`. The Builder the original evaluated and rejected was never needed here.

## Alternatives considered

- **`forwardRef` for cross-module cycles.** Rejected: it makes a cycle expressible instead of making it a design question.
- **A single `SharedModule` exporting every repository.** The common Nest shape. Rejected: it is the "everything a module builds is resolvable by every other" state ADR-0032 exists to end.

## References

- ADR-0006, ADR-0007, ADR-0021, ADR-0022, ADR-0024, ADR-0030.
