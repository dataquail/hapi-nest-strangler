# ADR-0035: The strangler campaign

- Status: Accepted
- Date: 2026-09-29

## Context and Problem Statement

ADR-0034 built the starting state: five modules on the hapi server, one on the Nest server, and a manifest that governs the Nest side in detail and the hapi side as one open node. What was missing is the thing the repository exists for — a statement, in the manifest, of how each hapi module leaves, and a count that only goes down.

The goodbones campaigns family is that statement: a campaign of ordered phases, each recognised by objectives, over sectors the code is split into, with a committed ledger per objective that records every place the objective still fires. `check` fails on a hit the ledger does not carry; the nudge tells whoever touches a sector what its phase is and what would move it on.

## Decision

**One campaign, `strangle-hapi`, in the root manifest.** Its scope is the hapi package and the Nest server's modules; its sectors are the five hapi modules; everything else in the hapi package is the legacy substrate.

**A sector is a hapi module, marked by `sector.ts` in its folder.** The marker exports a `sector` object naming the sector and listing what it owns: the module's folder, its tests, its migrations, and the Nest module it becomes (`packages/server/src/modules/<name>/`). The Nest folder is claimed before it exists, so the day it appears its files join the sector rather than the legacy. The marker is the one file the campaign adds to the hapi tree; it is read, never run, and the container never creates it.

**Six phases, five defined and one open.**

| Phase          | Recognised by                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fenced`       | `no-cross-module-reach` — no relative import of a sibling module and no sibling factory id in an `@require` list; `no-role-checks-in-routes` — no `isSuperAdmin` / `isMemberOf` / `isAdminOf` call in a route file |
| `rebuilt`      | `has-nest-module` — the sector owns a `*.module.ts` under the Nest modules folder                                                                                                                                  |
| `routes-moved` | `no-hapi-routes` — no hapi route file left in the module                                                                                                                                                           |
| `data-moved`   | `no-hapi-models` — no bookshelf model left                                                                                                                                                                         |
| `gone`         | `no-hapi-files` — nothing of the module left in the hapi package but its marker and its migration history                                                                                                          |
| `settled`      | open: what the departure leaves in the substrate, decided when the first module gets there                                                                                                                         |

A sector's phase is derived: the first phase with work left. `user` reaches nothing and checks no roles in its routes, so it starts at `rebuilt`; the other four start at `fenced`.

**One standing scalar, `hapi-lines`.** The non-blank lines each sector adds to the hapi package, held to the last cleared value. A module rebuilt on the Nest side weighs nothing, so rebuilding never reads as growth and only deletion reads as progress.

**The custom terms are functions in `campaigns/strangle-hapi.mjs`.** The cross-module reach and the line count are things no built-in term expresses — the reach lives half in import specifiers and half in the container's string ids — and the `fn` term is the engine's escape hatch for exactly that. Each function receives one file's path and text and returns the subjects it found, or a number. They are covered by the probes the manifest carries for them, which the loader runs before the policy loads.

**`onTouch: ratchet`.** A touched sector may not get worse; paying down is welcome in its own commit and never asked for. The editor rule reports a new holdout at its position; `check` fails on it; the nudge runs in `check:all` and is meant for the stop hook and the CI comment.

**Ledgers are committed under `.architecture-campaigns/`.** They only shrink on their own. `objectives clear` records progress, `objectives concede --reason` records growth with a reason, and a changed defined phase needs a concession entry on the phase before `check` accepts it.

## Consequences

- The strangling is now stated where the architecture is stated, and measured by the same tool that gates everything else. The first paydown is a separate change, on purpose: this ADR installs the meter and moves nothing.
- The hapi package gained five marker files. They are not part of the legacy shape and the legacy rule file says so.
- Every script that decodes the manifest must load the campaigns extension, or the `campaigns` and `ledger` keys are unknown keys; the edge table learned this the hard way. The findings log carries the rest of what the tooling did and did not make easy.
- What `settled` should recognise is not known yet. When the first sector arrives there, the note it leaves is the input to refining the phase.

## References

- `docs/plan/goodbones-findings.md` — the findings, including step 11's.
- ADR-0034 — the facsimile the campaign measures.
- <https://dataquail.github.io/goodbones/campaigns/getting-started/introduction/> — the campaigns family.
