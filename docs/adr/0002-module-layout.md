# ADR-0002: Module layout (domain / commands / queries / infrastructure / interface)

- Status: Accepted
- Date: 2026-04-25
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

Each feature module in the codebase needs an internal structure that:

1. Makes the layered-architecture rules expressible to tooling, so that violations fail compilation or CI rather than waiting on code review.
2. Keeps related files close together, so that finding "the thing that does X for the User feature" is mechanical.
3. Is consistent across modules, so that fluency with one module transfers to all of them.

There are two broad styles to choose between. **Vertical slicing** organizes a module by use case, with each slice containing its own controller, service, command, and DTO — the shape Nest's own generator produces. **Layered slicing** organizes a module by architectural role, putting all domain code together, all infrastructure code together, and so on.

Vertical slices keep one feature's files together but split closely-related concerns (commands vs. queries vs. domain vs. database) across many siblings. Folder names tend to mix concepts (a `database/` folder is infrastructure; a `dtos/` folder is interface) without saying so.

Layered slicing makes architectural roles explicit in folder names and aligns trivially with dependency-rule enforcement, at the cost of related-use-case files being slightly farther apart.

## Decision

Each feature module lives at `modules/<feature>/` with sibling subfolders, named after the architectural role of the files they contain:

```
modules/<feature>/
  domain/          — a container: no files live here directly. It holds one subdomain folder per aggregate, a domain-services/ folder, and a ports/ folder.
    <subdomain>/   — one aggregate's stereotypes, dot-delimited suffixes (ADR-0024): aggregate roots as two files — `*.root.ts` (the dumb `XRoot` zod schema + type) and `*.root-ops.ts` (the `XRootOps` free-function bag) — constituent aggregates `*.aggregate.ts`, entities `*.entity.ts` (`XEntity`), value objects `*.value-object.ts` (`XValueObject`), their behavior in sibling `*-ops.ts` bags, branded IDs `*.id.ts` (`XId`), specifications `*.specification.ts` (pure predicates over an aggregate), errors `*.errors.ts`, events `*.events.ts`, plus that aggregate's own repository port `*.repository.ts` (ADR-0005). Subdomains are isolated from one another; a subdomain may be repository-only (a lookup table with no aggregate root). See ADR-0003.
    domain-services/ — `*.domain-service.ts`: stateless logic no single aggregate owns; the one domain place allowed to compose more than one subdomain (ADR-0023)
    ports/         — the outbound ports that are not repositories, tiered by counterpart (see ADR-0022)
      clients/      — true third-party systems (`*.client.ts`)
      acl/          — other bounded contexts (`*.acl.ts`)
  commands/        — `*.command.ts` message class + `*.handler.ts` `@CommandHandler` class (registered from the module root)
  queries/         — `*.query.ts` message class + `*.handler.ts` `@QueryHandler` class (reads SQL directly; must not touch the domain core)
                     `*.policy-query.ts` marks a query published for other modules' authorization checks (ADR-0022)
  infrastructure/  — driven adapters, tiered by counterpart (see ADR-0022)
    repositories/  — `*.repository-live.ts` + `*.repository-fake.ts` + `*.mapper.ts`
    clients/       — third-party adapters (*.client-live.ts + *.client-fake.ts, self-contained *.client.ts, *.email.tsx templates)
    acl/           — anti-corruption adapters to other modules (*.acl-live.ts + *.acl-fake.ts); reads only this module's `<feature>.imports.ts`
  interface/       — inbound adapters, one subfolder per protocol
    http/          — one *.endpoint.ts controller per HTTP endpoint plus an index.ts barrel listing the controller classes (see ADR-0013); may also hold *.util.ts protocol helpers (ADR-0023)
    cli/           — one *.endpoint.ts per CLI endpoint plus an index.ts barrel; may hold *.util.ts
    events/        — one *.event-adapter.ts per domain event this module reacts to; a bus-only inbound port that dispatches one of the module's own commands (see ADR-0007)
  policies/        — *.policies.ts contribution, *.resource-resolver(s).ts, is-*.policy.ts checks
  sagas/           — declared in the taxonomy; holds no saga today
  # module root — a closed set of aggregation/composition files only (ADR-0024, ADR-0032)
  <feature>.module.ts                 — the Nest @Module: providers (handlers, lives, contribution, resolvers), controllers (endpoints), imports (peer modules), exports (what a peer resolves)
  <feature>.command-handlers.ts / .query-handlers.ts  — the declared messages, their handler classes, and the span-attribute extractors (ADR-0006, ADR-0012)
  <feature>.handlers.test.ts          — asserts every declared message has exactly one handler
  <feature>.event-span-attributes.ts  — per-event span-attribute extractors aggregated for this module
  <feature>.exports.ts                — the PEER surface: `<feature>Access{Commands,Queries,DomainEvents,Errors}`
  <feature>.imports.ts                — the inbound gateway: what this module takes from peers
  <feature>.platform.ts               — the PLATFORM surface: what the composition root names
```

Not every module has all folders — `queries/` is present only when the module needs it. Likewise `interface/http/` is present only for modules that expose HTTP endpoints; `interface/events/` only for modules that react to domain events. There is no `index.ts`: every file in a module root is a dot-delimited stereotype named for the plane it serves (ADR-0032).

`commands/` and `queries/` together correspond to what hexagonal architecture calls the "application layer." There is deliberately no `application/` umbrella over them. The split reflects one real distinction: write-side vs. read-side. A query must _not_ reach the write-side consistency boundary — it builds its own read model by reading SQL directly through `@org/database`, never by loading an aggregate through a repository. From its own `domain/` a query may still import two things that are not the write model — branded IDs and cross-context ACL ports (`domain/ports/acl/`, because ADR-0020 bans the cross-schema SQL that would otherwise fetch another context's data) — but nothing else. Read-side errors and derived statuses are query-owned (declared in the `.query.ts`), not borrowed from the domain. Each folder gets its own allowlist in the manifest (ADR-0008), so the architectural distinction shows up at the file-system level. A cross-aggregate reaction to a domain event is not a third application folder: it is an inbound adapter at `interface/events/` that dispatches one of the module's own commands (ADR-0007).

Cross-cutting platform services that don't belong to any feature live in a sibling `platform/` folder: the DDD contracts tier and the bus/unit-of-work tokens (`platform/ddd/`), the CQRS runtime (`platform/cqrs/`), the HTTP kernel (`platform/http/`), authentication and authorization (`platform/auth/`, `platform/middlewares/`), persistence helpers (`platform/database/`, `platform/persistence/`), notifications, and the composition root (`platform/modules/`).

### Cross-module access rules

Enforced by static analysis (see ADR-0008):

- Code outside a module reaches it only through one of its three root gateways: `<feature>.exports.ts` (peers), `<feature>.module.ts` (another module's `.module.ts`, for wiring), `<feature>.platform.ts` (the platform kernel and the composition root). ADR-0032.
- Modules do not reach into each other's internal folders directly.
- The peer surface is restricted: it may not re-export at all, and it names only domain vocabulary (events, IDs, errors) and the message classes a peer may construct — never a Nest module or a provider.
- Cross-module flow happens via three channels: the published HTTP contract, published domain events, or a dispatch made through the consumer's own outbound port (ADR-0022) against the shared bus (ADR-0006). Writes default to going through an event — Command → Event → Command, where the reacting module's `interface/events/` adapter subscribes and dispatches its own command — because that keeps the two modules' write paths independent. A write whose result the caller needs synchronously inside its own transaction is the exception and still goes through an outbound port.

### Typed-ID shared kernel and its governance

`platform/ids/` holds branded entity IDs that more than one module references — `UserId` is the load-bearing example: wallet stores it on the `WalletRoot`; todos commands carry it through `currentUser.userId`; auth's identity row targets it. Without a shared declaration, each module would redeclare the same `z.guid().brand<"UserId">()` and TypeScript would treat the two brands as distinct types, forcing coercion at every cross-FK boundary.

The kernel is allowlisted by the layer-isolation rules, so any layer can import an ID without weakening the layer's other constraints.

Shared kernels grow into dumping grounds without explicit rules. The governance is narrow and mechanical:

- **Allowed:** branded UUID types whose corresponding aggregate lives in _another_ module, defined as `z.guid().brand<"<Name>Id">()`. Nothing else.
- **Not allowed:** value objects, serialized shapes/DTOs (those are contracts), validation helpers, functions of any kind, and module-internal IDs.
- **Module-private IDs** (`WalletId`, `TodoId`) stay in `<module>/domain/`. An ID graduates to `platform/ids/` only when a **second** module needs to reference it; the PR adding the file must name both consumers.
- **Audit:** grep for `platform/ids/<file>` imports, count distinct module roots, and move any ID referenced by exactly one module back to that module's `domain/`.
- **Mechanical enforcement:** the `platform/ids/` node's allowlist admits only `zod`, so the folder cannot drift toward third-party-coupled shapes. Content discipline rests on the PR review above.

Moving IDs into `@org/contracts` is rejected: contracts are the HTTP wire shape consumed by both server and client, and a server-internal brand is meaningless (or duplicated) there. The contracts package declares its own `EntityIds` for the wire.

## Consequences

- Predictable navigation. Every module uses the same folder vocabulary.
- Per-use-case slicing (the strength of vertical slicing, and of Nest's generator) is given up. The role-based split aligns with the dependency rules, which is what we're optimizing for.
- A subscriber in another module reaches through the publisher's peer surface — the wallet module's `wallet.imports.ts` re-exports `organizationAccessDomainEvents` from `organization.exports.ts`, and its `interface/events/` adapter reads that. Domain events are part of the organization module's public contract, the same way the HTTP API is.
- Adding a new module is mechanical: create the folders the module needs, write `<feature>.module.ts`, and list it in `platform/modules/application-modules.ts` (plus `cqrs-runtime.ts` for its span attributes and `authz.module.ts` if it contributes policies). The rules apply automatically to any folder under `src/modules/`.
- If a long-running orchestration appears (saga, process manager) that doesn't fit "single command" or "single event reaction," `sagas/` is already declared for it.

## Supersedes / differs from the Effect edition

The layout is unchanged. The module root's `<feature>.module.ts` holds a Nest `@Module` rather than a record of Layers; `<feature>.shared-deps.ts` is gone (a Nest module's `providers` are its shared deps); `<feature>.handlers.test.ts` is new, because Nest's bus cannot refuse to boot on an unrouted message (ADR-0006).

## Alternatives considered

- **Vertical slicing** (folder per use case, Nest's default). Stronger cohesion within a use case; weaker cohesion of the architectural layer as a whole; harder to express dependency rules cleanly. Rejected for this codebase.
- **Three layers (domain / application / infrastructure) without `interface/`.** Rejected because the boundary between "use case" and "transport adapter" is the most-changed boundary in practice.
- **Single `application/` umbrella over commands and queries.** Rejected because read-side queries don't share dependency constraints with write-side commands.
- **Flat module layout with file-name conventions** (`user.entity.ts`, `user.service.ts`). Workable for small modules; conflates layer rules with naming conventions.
- **Eliminate `platform/ids/`; each module redefines its own brand.** Rejected: two `UserId` brands are distinct types to TypeScript.

## Related

- ADR-0008 (architecture enforcement) makes this layout a runtime check, not just a convention.
- ADR-0005 (repository pattern) details how the port lives in its aggregate's subdomain folder and the implementations in `infrastructure/repositories/`.
- ADR-0010 (HTTP-only contracts) details what `interface/` actually contains.
- ADR-0024 (dot-delimited filenames) — the stereotype filename convention these folders use.
- ADR-0032 (module imports and exports) — the three root gateways.
