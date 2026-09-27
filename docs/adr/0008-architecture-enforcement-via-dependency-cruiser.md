# ADR-0008: Architecture enforcement — import graph and file taxonomy as one manifest

- Status: Accepted (mechanism superseded by ADR-0027–ADR-0031; the policy here stands)
- Date: 2026-04-25
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); the slug is historical

## Context and Problem Statement

The earlier ADRs prescribe a layered architecture and a per-module folder layout (ADR-0002). None of that holds without tooling. A code-review-only strategy fails predictably: the first time someone imports `infrastructure/` from `domain/` to fix a bug "just this once," the convention erodes.

Two distinct properties need enforcing:

- **Import-graph rules** — "this set of paths may not depend on this other set."
- **File-taxonomy rules** — which file _kinds_ a folder admits (layout), which sibling files a stereotype requires (parity), and which subfolders a container admits.

This ADR was first written for dependency-cruiser plus a folder-structure ESLint rule. Both engines are gone (ADR-0027); the policy they expressed is what this record keeps, now written as the goodbones manifest (`architecture.yaml` at the root plus one `architecture.yaml` per package, ADR-0028/ADR-0031) and run under `pnpm lint` and `pnpm lint:architecture`.

## Decision

### Import-graph rules

**Per-folder isolation (per module).** Each module folder is a node with a positive allowlist naming exactly which paths and externals it may import:

- `commands/`: its own module's `domain/` and sibling `commands/`, `@nestjs/common` and `@nestjs/cqrs` (the vocabulary a message and its handler are declared in, ADR-0006), `oxide.ts`, `@opentelemetry/api` (for `trace.getActiveSpan()` annotations), and the platform tokens (`platform/ddd/`, `platform/cqrs/`, `platform/ids/`). No infrastructure, interface, or queries. No `@org/contracts` — a command's failure channel names domain errors and the endpoint maps them (ADR-0004) — and no `@org/database`. **Foreign module surfaces are not importable** — a call into another module goes through the consumer's `infrastructure/acl/` adapter (ADR-0022). Test files excluded.
- `queries/`: its own module's `domain/` (IDs, ACL ports) and sibling `queries/`, `@nestjs/cqrs`, `oxide.ts`, the platform tokens, and `@org/database` for direct SQL projection. Not commands, infrastructure, interface, `@org/contracts`, or foreign surfaces.
- `infrastructure/` may not depend on `interface/`.

**Operation-stereotype privacy (ADR-0003).** `*.root-ops.ts` is importable only from its own module's `domain/`, its own `commands/*.handler.ts`, test files and repository fakes; `*.entity-ops.ts` / `*.aggregate-ops.ts` / `*.value-object-ops.ts` are domain-private. `interface/events/*.event-adapter.ts` is bus-only: its own events/ids, its own command classes, the platform tokens, and — for cross-module events — its own `<feature>.imports.ts`.

**Domain isolation.** A module's domain may import itself, `zod`, `oxide.ts`, the DDD kernel's **contracts** tier (`platform/ddd/contracts/`), and `platform/ids/`. Nothing else — not `@nestjs/*`, not `slonik`, not the bus. Each subdomain folder is a boundary of its own; only `domain/domain-services/` may compose more than one.

The principle behind that tiering: **the domain may depend on shared types and contracts, but not acquire and invoke shared services.** `@org/event-bus` exports the event factory and the bus alike, so the allowlist cannot name the package; instead its domain-safe module is re-exported under this application's vocabulary from `platform/ddd/contracts/domain-event.ts`, and `platform/ddd/contracts/persistence-unavailable.ts` does the same for `@org/unit-of-work`. The bus token sits one level up, at `platform/ddd/event-bus.ts`, so a `domain/ports/` port structurally cannot name a bus.

**Module gateways (ADR-0032).** A module's internals are reachable only through `<feature>.exports.ts` (from a consumer's `infrastructure/acl/**` or `interface/events/**`, via that consumer's `<feature>.imports.ts`), `<feature>.module.ts` (from another module's `.module.ts`), and `<feature>.platform.ts` (from `platform/**`, `main.ts` and `test-utils/**`). The peer surface may not re-export and may not name a Nest module or provider.

**Repository dumbness (ADR-0005).** `infrastructure/repositories/*.repository-live.ts` may not import the module's use cases or the application-tier tokens.

**Cross-package boundaries.** `@org/contracts` reaches nothing; web never reaches the server; `@org/database` is the only package that names `slonik`'s driver; `@org/event-bus`, `@org/unit-of-work` and `@org/authz` name neither Nest nor slonik.

**Nest-specific prohibitions.** `EventBus`, `EventsHandler`, `Saga`, `ofType` from `@nestjs/cqrs` are refused everywhere (ADR-0007). `CqrsModule`, `makeEventBus`, `makeUnitOfWork`, `makeUnhandledFailures`, `makePolicyRegistry`, `makeResourceResolverRegistry` are fenced to the composition roots (`platform/cqrs/cqrs-runtime.ts`, `platform/modules/**`, `test-utils/**`) by name, since a path rule cannot tell a factory from the type beside it in a barrel.

**General hygiene.** No cycles (`import/no-cycle` in the editor, `no-cycles` in the CLI); production code may not depend on test files.

**A rule about a workspace package is only live if that package resolves.** Every rule matches on resolved paths; an unresolved import is a hard error, never a skip, and the resolution tsconfigs carry extensionless path targets so `@org/*` resolves to source.

### File-taxonomy rules

The taxonomy — layout, parity, subfolders — is the `children` / `requires` of each node, enforced by `architecture/structure` under `pnpm lint`.

- **Layout is deny-by-default.** A folder that enumerates its `children` rejects any file or subfolder not matched. Container folders (`domain/`, `domain/ports/`, `infrastructure/`, `interface/`) admit no direct files. A module admits only `domain/ commands/ queries/ event-handlers/ sagas/ infrastructure/ interface/ policies/` and the closed set of root files.
- **Parity is `requires`.** A stereotype file names the siblings it owes, resolved against the real filesystem, anchored on the port for adapters.
- **Didactic messages.** Each node carries a `message` that tells a contributor what to do.

The obligations:

| When you create…                                              | Sibling required                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/<subdomain>/*.root.ts`                                | — (a dumb schema; no test obligation)                                                                                                       |
| `domain/<subdomain>/*.root-ops.ts`                            | `<base>.root-ops.test.ts`                                                                                                                   |
| `domain/<subdomain>/*.specification.ts`                       | `<base>.specification.test.ts`                                                                                                              |
| `domain/<subdomain>/*.{entity,aggregate,value-object}-ops.ts` | `<base>.<stereotype>.test.ts`                                                                                                               |
| `domain/domain-services/*.domain-service.ts`                  | `<base>.domain-service.test.ts`                                                                                                             |
| `commands/*.handler.ts`                                       | `commands/<base>.handler.test.ts`                                                                                                           |
| `queries/*.handler.ts`                                        | `queries/<base>.handler.integration.test.ts`                                                                                                |
| `interface/{http,cli}/*.endpoint.ts`                          | `<base>.endpoint.integration.test.ts` (login/logout exempted — ADR-0013)                                                                    |
| `interface/{http,cli}/*.util.ts`                              | `<base>.util.test.ts`                                                                                                                       |
| `interface/events/*.event-adapter.ts`                         | `<base>.event-adapter.test.ts`                                                                                                              |
| `domain/<subdomain>/*.repository.ts`                          | in `infrastructure/repositories/`: `<base>.repository-live.ts` + `<base>.repository-fake.ts` + `<base>.repository-live.integration.test.ts` |
| `domain/ports/clients/*.client.ts`                            | in `infrastructure/clients/`: `<base>.client-live.ts` + `<base>.client-fake.ts` + `<base>.client-live.test.ts`                              |
| `domain/ports/acl/*.acl.ts`                                   | in `infrastructure/acl/`: `<base>.acl-live.ts` + `<base>.acl-fake.ts` + `<base>.acl-live.test.ts`                                           |
| `<feature>.command-handlers.ts` / `.query-handlers.ts`        | `<feature>.handlers.test.ts` (boot completeness, ADR-0006)                                                                                  |

### Why no `application/` folder

The application layer is `commands/` and `queries/`. Queries may touch `@org/database`; commands may not — so they do not share dependency constraints, and an umbrella would imply a kinship that isn't there.

## Consequences

- Architecture violations fail CI, not code review, and cannot be silently weakened: every rule carries a probe it must fire on, or the linter refuses to load (ADR-0027).
- Adding a module requires no policy change — the `{module}` capture covers it.
- Don't fight a rule by widening it; fight it by changing the design. If a command legitimately needs infrastructure, that is a missing port.
- Test code is exempt from the per-folder isolation rules by named test-file fragments, easier to audit than a separate ignore list.

## Supersedes / differs from the Effect edition

Every external in every allowlist changed (`effect` → `zod` + `oxide.ts`; `@effect-server-utils/*` → `@nestjs/*` and `@org/*`); the fenced factories changed; a Nest-specific prohibition on the framework's own event bus was added; a `handlers.test.ts` parity obligation was added. The families, the tiers and the messages are the same.

## Alternatives considered

- **Nest's own module encapsulation as the boundary.** Rejected — Nest checks that a provider is _available_, not that an import is _allowed_; a handler can import a foreign class as a type and be wired to it by a global module without any Nest error.
- **Build-system enforcement** (separate TS projects per layer). Rejected — cannot express the test exemption.
- **No enforcement, rely on code review.** Rejected.

## Related

- ADR-0001, ADR-0002, ADR-0005, ADR-0009, ADR-0027–ADR-0032.
