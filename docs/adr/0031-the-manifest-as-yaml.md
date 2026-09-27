# ADR-0031: the architecture manifest as YAML, one file per package

- Status: Accepted
- Date: 2026-09-06
- Re-authored for the Nest edition: 2026-09-13 (ADR-0033)

## Context and Problem Statement

The manifest of ADR-0028 was first authored as JavaScript modules, then as one 1800-line YAML file when the engine learned to read data manifests, and finally as YAML split by `include` once the engine could assemble one policy from several files. This repository starts on the last form; the ADR records what that form is and how it is divided, because the division is a decision a contributor meets on the first rule they add.

## Decision

**The manifest is YAML: a root `architecture.yaml` that includes one `architecture.yaml` per package, beside the package it governs.** The pins are `@goodbones/*@0.1.0-beta.6`.

- **The root holds what is true of the whole repository, and the index.** `resolve`, `aliases` (`@` → `packages/server/src`, `~` → `packages`), the repo-wide `deny` and `exports`, `graph`, `limits`, the fragments more than one package uses, and under `tree` one `include` line per package. An include is replaced whole — nothing may be written beside it, and there is no merge — so the root's `tree` is the complete list of files that take part.
- **One node file per package, beside the package.** Fourteen: `acceptance`, `api-client`, `authz`, `cli`, `components`, `contracts`, `database`, `event-bus`, `jobs`, `mcp`, `server`, `test-drivers`, `unit-of-work`, `web`. Each names the node schema on its first line so an editor validates it as one node of the tree.
- **A fragment lives in the narrowest file that covers all its users.** Every file's `defs` share one namespace and a name defined twice is refused. The server's four test fragments, `constituent-ops`, `port-consumers`, `acl-port-consumers`, `endpoint-imports` and the rest of its vocabulary sit in the server's file; `view-file` and `view-model-file` in web's; `no-default-exports`, `test-exports-nothing`, `frontend-test-file` and the three kernel packages' test fragments in the root.
- **`use` is a shallow override.** A key written beside `use` replaces the fragment's key of the same name; a list does not merge. That is why each root that adds a default-export exemption repeats `**/vitest.config.ts` beside its own.
- **Quote every glob and every message.** A bare `*` opens an alias, `@` and a backtick are reserved, `{` opens a flow mapping, and ` #` starts a comment. Long messages are `>-` folded block scalars. Prettier formats the files on commit.
- **`lint:edges` reads the manifest the way the hosts do**, through the engine's own find → read → decode, so the edge table is judged against the assembled policy exactly as the plugin and the CLI see it.

## Consequences

- A decode error names a file and a line, and the file is the one beside the package.
- A package's policy is one file next to its code with nothing else in it; nothing in the policy is JavaScript, so nothing in it can drift into being a little engine of its own.
- An included file is replaced whole, so a section cannot be assembled by merging; a fragment two packages share moves up to the root.

## Supersedes / differs from the Effect edition

Nothing in the form. The set of node files grew by three (`authz`, `event-bus`, `unit-of-work`), and their test fragments live in the root because the root is the narrowest file that covers a kernel package and the server tests that take its `testing` entry.

## Alternatives considered

- **One `architecture.yaml`.** Rejected: the 1800-line shape the split exists to escape.
- **YAML anchors and merge keys instead of `defs`.** Rejected: they cannot cross an include and an error inside a merged key cannot name its line.
- **`architecture.json`.** Rejected: no comments, and the comments are most of the manifest.

## References

- ADR-0028, ADR-0029, ADR-0030; the manifest reference at <https://dataquail.github.io/goodbones/>.
