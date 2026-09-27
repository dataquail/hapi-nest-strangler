# ADR-0027: architecture rules as configuration, in one oxlint plugin

- Status: Accepted
- Date: 2026-08-31
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033); the mechanism is unchanged, the policy it runs is this repository's

## Context and Problem Statement

Architectural enforcement in the Effect edition once lived in three engines that did not talk to each other — dependency-cruiser for the import graph, a vendored fork of `eslint-plugin-project-structure` for the file taxonomy, and hand-rolled oxlint rules for the rest. All three did the same thing: _match a fact about a file — its path, its imports, its declared members — against a policy, and report a didactic message._ Only the fact-gathering differed.

Two objections had to be answered before consolidating.

**Graph reachability.** A per-file lint rule has no dependency graph, so it cannot detect cycles. Of the original rules exactly one needed the graph, and oxlint ships `import/no-cycle` natively (the whole-graph rules came later, ADR-0030).

**Resolution.** dependency-cruiser's value was that it resolved every import to a real file, so `@org/contracts/Policy`, `../../Policy.js` and `node_modules/.pnpm/…/zod/index.js` all matched as the file they are. A rule engine matching import _specifiers_ is a weaker thing wearing the same shape. This was the real requirement.

## Decision

Express architecture policy as **configuration**, enforced by one oxlint JS plugin that resolves every import with `unrs-resolver` (the same native resolver oxlint uses internally) before matching. This repository installs that plugin as `@goodbones/oxlint` (ADR-0029) and writes the configuration as `architecture.yaml` (ADR-0031).

Five rule families, one config, one command:

| Rule                     | Question it answers                                      |
| ------------------------ | -------------------------------------------------------- |
| `architecture/imports`   | may this file import that one?                           |
| `architecture/exports`   | may this file import _that name_ from it?                |
| `architecture/members`   | may this file declare or call that name?                 |
| `architecture/structure` | may this file exist here, and what siblings does it owe? |
| `architecture/surface`   | what may this file export?                               |

`exports` is the family a path rule cannot express: every importer of a barrel resolves to the same file, so only the imported _name_ separates `makeEventBus` from the `EventBus` type beside it. This repository uses it to fence the kernel factories — `makeEventBus`, `makeUnitOfWork` and `makeUnhandledFailures` to `platform/cqrs/` and `test-utils/`; `makePolicyRegistry`, `makeResourceResolverRegistry` and `makeHasPermissions` to `platform/auth/` and `platform/modules/` — and to refuse `@nestjs/cqrs`'s `EventBus`, `EventsHandler`, `Saga`, `ofType`, `IEvent` and `IEventHandler` everywhere (ADR-0007).

### Every rule carries a probe, and the plugin refuses to load without one

The failure mode that matters is not a crash. It is a rule going silently vacuous — still configured, still passing, enforcing nothing — which a clean lint run cannot distinguish from a clean codebase. So every rule carries a probe, generated from the node's own path or authored for a declaration shape, and the plugin evaluates all of them at load and **fails the lint run** if any rule does not report its own probe.

`scripts/lint-rule-probes.mjs` keeps the other half — that the plugin is loaded, the rule id is enabled, its globs match, and resolution is live.

### An unresolved import is an error

An unresolvable import is an import no rule can police. The plugin fails instead of skipping. This is the same principle as the probe: failing open disarms rules without changing a line of config.

## Consequences

**One command, one config.** `pnpm lint` runs the file taxonomy and the import boundaries together with the ordinary rules.

**Five rule ids, not fifty.** `architecture/imports` is one oxlint rule; each policy rule's name rides in the message. Per-violation suppression is the baseline's job, not `oxlint-disable`'s.

**The plugin arrives built.** oxlint loads plugins with a bare `import()`; the published tarball carries compiled JavaScript, so no lint command builds anything and there is no local `build/` to go stale.

**oxlint's JS plugin API is alpha.** The engine's core is adapter-free — pure functions over `(path, resolved target)` — so the policy survives an API break.

## Supersedes / differs from the Effect edition

Nothing about the mechanism. What the policy fences changed: the `@effect-server-utils/*` factories became the `@org/*` kernel factories plus `CqrsModule`, and the `effect/unstable/rpc` prohibition became the `@nestjs/cqrs` event-bus prohibition.

## Alternatives considered

- **Keep dependency-cruiser, extract only the taxonomy.** Rejected: two engines, two resolution configs, two commands.
- **`eslint-plugin-project-structure`'s `independent-modules`.** Rejected: it matches specifiers rather than resolved files and gives each file exactly one allowlist and one message.
- **Reuse dependency-cruiser as a library, driven from oxlint.** Rejected: it builds the whole graph per run, which is the cost the per-file model avoids.

## References

- ADR-0008 — architecture enforcement; this ADR describes the engine that runs its policy.
- ADR-0025 — oxlint as the linter; this ADR extends its plugin model.
- ADR-0028, ADR-0029, ADR-0030, ADR-0031 — the manifest, the engine as a dependency, the whole-graph rules, the YAML form.
