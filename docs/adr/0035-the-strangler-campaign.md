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

## Amendment 2026-10-01: phases for a dual-write strangling

The first sector to move showed the plan's middle was shaped for a shared table: `rebuilt` straight to `routes-moved`, with the data following. The repository's principle is that the two servers share no persisted data — the Nest module owns its schema from the day it exists, so its domain is free to differ from the legacy row — which makes the realistic path a dual-write: hapi stays the source of truth and forwards every write to the Nest module's internal API, the Nest table is backfilled once, then hapi's routes forward to Nest one operation at a time until nothing is left to move.

**Nine phases, seven defined, one attested, one open.**

| Phase          | Recognised by                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fenced`       | unchanged                                                                                                                                                                                                            |
| `rebuilt`      | unchanged: `has-nest-module`                                                                                                                                                                                         |
| `mirrored`     | `has-internal-write-api` — a Nest endpoint naming the inter-service guard; `writes-not-mirrored` — a knex `insert`/`update`/`del` in a hapi service method that makes no backend-client call, counted until `served` |
| `backfilled`   | attested: no detector sees a backfill run, so whoever ran it records it with `campaigns attest`                                                                                                                      |
| `served`       | `has-nest-endpoints` — a Nest endpoint naming the user guard; `routes-still-local` — a hapi route whose `handler:` is not `proxyToNest(...)`; `legacy-writes` — any knex write left in a hapi service                |
| `routes-moved` | unchanged: `no-hapi-routes`                                                                                                                                                                                          |
| `data-moved`   | `no-hapi-models`, and `legacy-table-dropped` — a `*_drop_*` migration in the legacy folder, since the table is dropped rather than moved                                                                             |
| `gone`         | unchanged: `no-hapi-files`                                                                                                                                                                                           |
| `settled`      | open, unchanged                                                                                                                                                                                                      |

**`mirrored` advises instead of ratcheting.** The legacy module grows there by design — every write gains a forward — so the phase carries `onTouch: advise` and the campaign-wide ratchet resumes at `served`.

**The operation-grained objectives are `syntax` terms** over the hapi code shape: ast-grep rules with `inside`, `has` and `not`, probed like every other detector. They count statements and route definitions rather than files, so a PR that mirrors one write or proxies one route moves a number. The cost is that they describe this codebase's shape; a real campaign writes its own.

**Concessions were receipted** on `routes-moved`, `data-moved` and `gone`: the first and last only moved later in the list, the middle one gained an objective.

### Consequences of the amendment

- The sectors re-derived honestly: `todo` and `user` stay at `rebuilt`, the others at `fenced`.
- A dual-write strangling needs a step no detector can see. `backfilled` is the first attested phase, and the campaign history will carry who attested it and with what evidence.
- The findings for this amendment are in `docs/scratch/campaign-rough-edges.md`, entries 18 onward.
