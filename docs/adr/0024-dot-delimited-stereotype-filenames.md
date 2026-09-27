# ADR-0024: Dot-delimited stereotype filenames

- Status: Accepted
- Date: 2026-07-02
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

A stereotype signifier in a filename must be machine-parseable — the layout and parity checkers (ADR-0008) key off it, and a reader (or an agent) should be able to name a file's role without a lookup table. A dash separator is ambiguous: in `api-token-repository.ts` nothing marks where the concept ends and the role begins. Nest's own convention — `todos.controller.ts`, `todos.service.ts` — is already dotted; this ADR keeps the dot and replaces Nest's role vocabulary with the DDD one.

## Decision

**Every file in a module stereotype folder is named `<concept>.<stereotype>[.<qualifier>].ts`.** Dots delimit stereotype segments; dashes appear only _within_ a kebab-case concept name.

- **Dashes are word-separators inside a name only** — `api-token`, `find-users`, `stripe-webhook`.
- **Dots delimit the stereotype and any qualifier** — matching `*.root-ops.test.ts` / `*.endpoint.integration.test.ts`.
- **Compound stereotypes keep their internal dash as one segment** — `*.repository-live.ts`, `*.repository-fake.ts`, `*.value-object.ts`, `*.event-adapter.ts`, `*.resource-resolver.ts`, `*.domain-service.ts`, `*.root-ops.ts`.
- **Handlers get an explicit stereotype.** A command is `<verb-noun>.command.ts` (the message class) + `<verb-noun>.handler.ts` (the `@CommandHandler` class).
- **There is no `.controller.ts` and no `.service.ts`.** An endpoint file is `*.endpoint.ts` even though the class inside is a Nest controller (ADR-0013); a Nest module file is `<feature>.module.ts`, which is the one Nest name that already said what it is.

### The full vocabulary

| Folder                         | Stereotype filenames                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/<subdomain>/`          | `.root` · `.root-ops` · `.aggregate` · `.aggregate-ops` · `.entity` · `.entity-ops` · `.value-object` · `.value-object-ops` · `.id` · `.errors` · `.events` · `.specification` · `.repository` |
| `domain/domain-services/`      | `.domain-service`                                                                                                                                                                              |
| `domain/ports/clients/`        | `.client`                                                                                                                                                                                      |
| `domain/ports/acl/`            | `.acl`                                                                                                                                                                                         |
| `commands/` · `queries/`       | `.command` / `.query` (message class) + `.handler`; `.policy-query` for a query published as a cross-module authorization contract (ADR-0022)                                                  |
| `infrastructure/repositories/` | `.repository-live` · `.repository-fake` · `.mapper`                                                                                                                                            |
| `infrastructure/clients/`      | `.client-live` · `.client-fake` · `.client` (self-contained) · `.email` (tsx)                                                                                                                  |
| `infrastructure/acl/`          | `.acl-live` · `.acl-fake`                                                                                                                                                                      |
| `interface/http,cli/`          | `.endpoint` · `index.ts` (the endpoint list) · `.util`                                                                                                                                         |
| `interface/events/`            | `.event-adapter`                                                                                                                                                                               |
| `policies/`                    | `.policies` · `.resource-resolver(s)` · `.policy` (the `is-*` checks)                                                                                                                          |
| module root                    | `.platform` · `.exports` · `.imports` · `.module` · `.command-handlers` · `.query-handlers` · `.event-span-attributes` · `.handlers.test`                                                      |

Tests append their qualifier to the subject stereotype: `*.handler.test.ts`, `*.repository-live.integration.test.ts`, `*.event-adapter.test.ts`.

### The identifier carries the stereotype too

The exported identifier is what appears at a call site, so it carries the same keyword: `XRoot`, `XRootOps`, `XEntity`, `XValueObject`, `XId`. A `.command.ts` exports `XCommand`, a `.query.ts` exports `XQuery`, a `.handler.ts` exports `XHandler`, an `.endpoint.ts` exports `XEndpoint`. For a message the identifier is also exactly its span name (`command.CreateTodoCommand`, ADR-0012), so the declaration and the string it is observed under cannot drift apart. The payload type stays `XPayload`, and the result alias is `XResult` (ADR-0006).

### Scope

This applies to the module **stereotype folders** and the **module root**, whose files are the _only_ ones the module root admits (ADR-0032). There is no `index.ts` in a module root.

The `platform/`, `common/`, and `test-utils/` trees remain deliberately **excluded**: they hold kernel/wiring/support code with descriptive kebab names (`cookie-codec.ts`, `user-auth.guard.ts`, `cqrs-runtime.ts`), not DDD stereotypes.

## Enforcement

The `architecture/structure` allowlists in `packages/server/architecture.yaml` are expressed in dot-form, and a node's `name` convention judges the concept name in front of the first dot (ADR-0028). Because the naming _is_ the detector for these checkers, a file that uses a dash suffix for a stereotype — or Nest's `.controller.ts` — fails the build.

## Consequences

- Every file's role is legible from its name without a lookup table.
- Handlers are first-class stereotypes rather than the unmarked residue of a folder.
- Same-basename files that map to _different_ stereotypes are disambiguated by folder.

## Supersedes / differs from the Effect edition

The vocabulary gains nothing and loses nothing; what changed is that Nest's `.controller.ts` / `.service.ts` / `.dto.ts` conventions are explicitly not adopted, and the module root gained the `.exports` / `.imports` / `.platform` planes from ADR-0032.

## Alternatives considered

- **Adopt Nest's `.controller.ts` / `.service.ts` vocabulary.** Rejected — a "service" is not a stereotype in this architecture, and a controller class is an endpoint's container, not its role.
- **Nested-dot compound impls (`.repository.live.ts`).** Rejected in favour of the hyphen-compound so live/fake read as one stereotype.
- **Extend to platform/common/test-utils.** Rejected — those are not DDD stereotypes.

## Related

- ADR-0002, ADR-0003, ADR-0008, ADR-0022, ADR-0023, ADR-0032.
