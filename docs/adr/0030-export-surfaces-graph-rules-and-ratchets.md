# ADR-0030: export surfaces, graph rules and adoption ratchets

- Status: Accepted
- Date: 2026-09-02
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

A per-file import allowlist can say what a file may import and which names it may declare, but not what it may _export_, nothing about the shape of the whole import graph, and nothing about the policy itself — how much of the tree its rules reach. Three families answer those: `surface`, `graph` and `limits`. This edition inherits all three and restates what they fence, because the names that must be fenced changed with the framework.

## Decision

### `surface`: what a file may export

- **No default exports**, at every root, except where a framework demands one: Next routes and config, knex migrations, stories and the Storybook config, vitest configs and `globalSetup`. Each exemption is `except` beside the rule at its root.
- **No `export *`** in the server and web. The two named exemptions are `platform/ddd/contracts/domain-event.ts`, which re-exports the event-bus package's event vocabulary under DDD names, and the web test-fixtures barrel.
- **A handler file exports exactly one `*Handler`**, and it is a class: `CreateTodoHandler`, decorated `@CommandHandler(CreateTodoCommand)`. A `.command.ts` / `.query.ts` file exports the message class, its `XPayload` and its `XResult` alias, nothing else.
- **A port exports types and its abstract class, never a value.** Every port is `export abstract class XRepository { abstract findOne(…): Promise<Result<…>> }`; a `const` or function there is an implementation, and implementations live behind the port.
- **The peer surface declares only `<module>Access<Queries|Commands|DomainEvents|Errors>` values and re-exports nothing** (ADR-0032).
- **A test exports nothing.**

### `exports`: symbols fenced by name

An allowlist admits a package or refuses it; it cannot refuse one export of a package it admits. Four `exports` restrictions do that (root `architecture.yaml`):

| Rule                                    | Symbols                                                                                      | Where allowed                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `bus-factories-at-composition-roots`    | `makeEventBus`, `makeUnitOfWork`, `makeUnhandledFailures`                                    | `platform/cqrs/`, `test-utils/`, tests       |
| `authz-registries-at-composition-roots` | `makePolicyRegistry`, `makeResourceResolverRegistry`, `makeHasPermissions`                   | `platform/auth/`, `platform/modules/`, tests |
| `no-nest-event-bus`                     | `EventBus`, `EventsHandler`, `Saga`, `ofType`, `IEvent`, `IEventHandler` from `@nestjs/cqrs` | nowhere                                      |
| `no-whole-nest-cqrs-imports`            | the `namespace` binding of `@nestjs/cqrs`                                                    | nowhere                                      |

The last exists because every whole-module form — `import * as`, `export *`, `import()`, `require()` — is one `namespace` binding named `*`, which a `symbols` list cannot see; without it the third rule has a way around.

### `graph`: cycles, orphans and reach, in the CLI only

Only `pnpm lint:architecture` evaluates graph rules; the plugin compiles and probes them so a vacuous one still fails `pnpm lint`, but never runs them. **A violated graph rule fails `lint:architecture` alone**, which is why the CLI is a gate in `check:all` and not a mirror of the linter.

- `no-cycles` over every package; oxlint's `import/no-cycle` stays on for editor speed.
- `no-orphans` over every package, with an `entry` list of claims: test files and configs are loaded by a runner; `main.ts`, the CLI, MCP and jobs bins and the database scripts are process entrypoints; Next's `app/**`, `instrumentation.ts`, `next.config.ts` and the Storybook config are framework-loaded; each package's published entry is reached by its dependants through `exports`. Fakes are `withinNot`: the taxonomy owes a fake to its port whether or not a test takes it.
- Five `reach` rules: the domain and the use cases reach no adapter, `platform/` reaches a module only through its `<feature>.platform.ts`, web never reaches the server, contracts reach nothing.

### `limits`: the policy measures itself

```yaml
limits:
  unrestricted: 1
  partial: 0
  coverage: { imports: 0.99, structure: 0.71, members: 0.03, surface: 0.95, graph: 1 }
```

The ceilings cap the tiers that say "not tightened yet" — one, `main.ts`. The floors are what `pnpm architecture:coverage` reported when written, rounded down, and ratchet upward only. `members` is honestly small: the vocabulary rules select repository ports and Views, and nothing else has a vocabulary to police yet.

### Authored probes where a generated one proves nothing

`members`, `exports` and `surface` rules about a declaration shape carry `probe: { source, … }`, a snippet parsed at load out of which the rule must report a site. The repository-vocabulary rules are probed with an intersection type; the four `exports` restrictions each carry the import line they refuse.

## Consequences

- Every new rule was planted as a violation and seen to fire under the host that owns it.
- The CLI is a gate: dropping it from CI would silently drop cycles, orphans, reach and the coverage floors.
- The reason a contributor cannot reach for `@EventsHandler` is a lint message that names ADR-0007, not a code-review comment.

## Supersedes / differs from the Effect edition

`bus-factories-at-composition-roots` fenced six Effect-library factories and `no-whole-server-utils-imports` fenced `@effect-server-utils/*`; here the factories are the kernel packages' and the namespace fence is on `@nestjs/cqrs`, whose event bus is additionally refused by name. The "port exports its Tag class" rule became "port exports its abstract class". The ACL-fake tension the original recorded (fakes owed by parity but taken by no test) still holds, unchanged.

## Alternatives considered

- **Drop `import/no-cycle` now that `no-cycles` exists.** Rejected for now: editor-speed feedback at no measurable cost.
- **Allow Nest's `EventBus` for post-commit reactions only.** Rejected: it cannot wait for the commit either, so it is neither consistency model ADR-0007 offers.

## References

- ADR-0007, ADR-0021, ADR-0028, ADR-0029, ADR-0032.
