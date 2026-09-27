# ADR-0029: the architecture engine as a dependency

- Status: Accepted
- Date: 2026-09-02
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

The engine that evaluates the manifest was once source inside the repository that used it. Two costs came from that. The repo's own gates measured the wrong thing: `pnpm lint`, `pnpm check` and the coverage thresholds all pointed at `packages/`, so a lint plugin's lines sat inside every number a reference application publishes about itself. And every lint command was a build command, because oxlint loads a plugin with a bare `import()` and a stale `build/` enforces a stale policy while linting green.

Underneath both: a library and a repository that uses it were sharing a version, so a behaviour change in the engine could never show up as a diff.

This repository was created after the extraction and never carried the engine. The decision is recorded because the rest of the toolchain is arranged around it, and because the same question — vendored or installed — came up again for the three kernel packages.

## Decision

Depend on the published engine. `@goodbones/core`, `@goodbones/typescript`, `@goodbones/oxlint` and `@goodbones/cli` ship from `dataquail/goodbones` and are installed at the workspace root, pinned to one exact beta (`0.1.0-beta.6`).

| Stays here                                                       | Lives in the engine                            |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| `architecture.yaml` + one `architecture.yaml` per package        | resolution, lowering, glob matching, the graph |
| `scripts/lint-rule-probes.mjs`, `scripts/architecture-edges.mjs` | the five rule families and their probes        |
| the `limits.conformance` ceilings (once a script of this repo's) | the CLI, the baseline, `explain`, `facts`      |
| `.architecture-baseline.json` (absent — no violations)           | the library's own tests and documentation      |

Three seams carry the dependency: `.oxlintrc.json` names `@goodbones/oxlint/plugin`; the `lint:architecture` and `architecture:*` scripts call the `architecture` bin; the edge table imports the engine's public loading and evaluation functions.

### The kernel packages are the opposite decision, on purpose

`@org/event-bus`, `@org/unit-of-work` and `@org/authz` are **workspace packages, not installed ones**. They were written from scratch for this edition (ADR-0007, ADR-0021), their shape is still moving with the application that exercises them, and a rule-family change in an engine is a different thing from a delivery-contract change in a bus. They are held apart from the server the way an installed library would be — each has its own manifest node, its own test fragment and its own `exports` fence — so that extracting them later is a `package.json` change rather than a refactor. Until they stop moving, one commit that changes a bus and the handler that relies on it is the right unit.

## Consequences

- `pnpm lint:rules` and `pnpm lint:edges` get a second job: across an engine version bump they prove the engine still evaluates the policy the same way. That is why the pin is exact rather than caret.
- No lint command builds anything; there is no local `build/` to go stale.
- The kernel packages sit inside the coverage denominator and the lint surface, and that is the intended reading: they are this application's code until they are not.

## Supersedes / differs from the Effect edition

The Effect edition installed both its engine and its CQRS/unit-of-work/authz libraries from separate repositories. This edition installs the engine and keeps the kernel in the workspace; the section above says why.

## Alternatives considered

- **Vendor the built plugin.** Rejected: a checked-in artifact drifts from a source nobody diffs, and forfeits the version number that makes an engine change reviewable.
- **Install the kernel packages from the Effect edition's repository.** Not possible — they are written against Effect — and not desirable: the whole point of this edition is a kernel with no framework underneath it.

## References

- ADR-0027, ADR-0028, ADR-0025, ADR-0007, ADR-0021, ADR-0033.
