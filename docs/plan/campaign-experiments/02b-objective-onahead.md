# Step 2b: `onAhead` per objective

A brief for a session working in the **goodbones** repository (`dataquail/goodbones`). It is
self-contained. It follows `02-engine-fixes.md`, whose O1 shipped in `@goodbones/campaigns@0.1.1-beta.5`, and
fixes the one regression gate 3 found in it. The evidence is finding **R9** in
`docs/plan/campaign-experiments/results/seeded-faults-campaigns-0.1.1-beta.5.md` of
`dataquail/hapi-nest-strangler` (PR #38). Owner's decision (2026-10-06): add an `onAhead` setting per
objective.

## Engine version this brief was written against

`@goodbones/{core,typescript}` `0.1.0-beta.15`, `@goodbones/{cli,oxlint}` `0.1.0-beta.16`,
`@goodbones/campaigns` `0.1.1-beta.5`. Source paths are inside `@goodbones/campaigns/src`.

## The problem

O1 reports a holdout paid down of an objective whose window opens after the sector's phase as `ahead of
plan`, and under `onAhead: ratchet` the nudge exits non-zero. That is right for fault F4: reads served before
the backfill is attested. It is wrong for an objective that counts **what is left of a sector**.

`strangle-hapi` has one: `no-hapi-files` (phase `gone`, `holdout: file`, every file in the sector's hapi
folder). A strangler deletes hapi files from its first phase on, so every deletion pays `no-hapi-files` down
"ahead of plan". Replaying the billing stack's 14 layers through the CI nudge
(`harness/replay-stack.mjs`) on beta.5 with `onAhead: ratchet` refuses three legitimate layers:

| Layer                | Nudge output                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `fenced`             | `ahead of plan: no-hapi-files −1 belongs to gone; organization is at fenced`  |
| `serve-writes-proxy` | `ahead of plan: no-hapi-files −7 belongs to gone; billing is at routes-moved` |
| `routes-moved`       | `ahead of plan: no-hapi-files −2 belongs to gone; billing is at data-moved`   |

The manifest cannot exempt the objective today. `onAheadOf` (`core/phases.ts:175`) reads
`rule.phases[judgedAt]?.onAhead ?? rule.onAhead ?? "advise"`: the override belongs to the phase the sector is
judged at, not to the objective that was paid down. Setting the campaign to `advise` would give up F4,
because `check` and the lint rule do not judge "ahead" (R10).

## The change

### Manifest

`onAhead` on an objective, beside `how`, `until`, `match`:

```yaml
no-hapi-files:
  holdout: file
  onAhead: ignore
  how: …
```

Values: `advise | ratchet | ignore`. `ignore` is new, and every level that takes `onAhead` (campaign, phase,
objective) may use it, so the literal set stays one set (`domain/config.ts:302`, `manifest/spec.ts:381`).

### Semantics

- **Each paid-down objective resolves its own weight:** `objective.onAhead ?? phase[judgedAt].onAhead ??
campaign.onAhead ?? "advise"`. The objective's own setting wins, whatever phase the sector is judged at.
- `ignore`: the entry is left out of `ahead` entirely. It produces no text line and no JSON entry, and does not
  change the verdict.
- `advise`: the entry is listed, and the verdict does not change.
- `ratchet`: the entry is listed, and the verdict is `ahead` (exit non-zero) if it would otherwise be `ok`. This
  is today's rule, applied per entry instead of once per sector.
- The sector's verdict is `ahead` when **any** listed entry resolves to `ratchet`.
- Everything else about O1 is unchanged: the window test (`from <= state.phase` skips), measures and
  `overShared` objectives skipped, the legacy and shared sectors skipped, judged against the base side.

### Output

`host/nudge.ts` ~1067 prints one `onAhead: <x>` for the sector. With per-entry weights, show each entry's
weight wherever the listed entries do not all share one, e.g.
`ahead of plan: has-nest-endpoints −1 belongs to served (ratchet) · no-hapi-models −1 belongs to data-moved
(advise); billing is at backfilled (not yet attested)`. Add the resolved weight to each entry of
`SectorNudge["ahead"]` and to the `--json` output.

### The plan receipt

An objective's `onAhead` changes what the nudge refuses, so it is a plan change and must be receipted. Fold it
into the objective's entry in its phase's definition digest (`manifest/lower.ts` ~652–684), **only when
present**, as `over` and `measure` are. A phase whose objectives set no `onAhead` must hash exactly as on
beta.5, so no committed `plan.json` reads as changed. Adding `onAhead` to `no-hapi-files` will then ask for a
`concessions` entry on `gone`. That is intended.

Not required here: the separate finding that the campaign-level and phase-level `onTouch`/`onAhead` leave no
receipt (`goodbones-findings.md`, "a campaign-level onAhead leaves no plan receipt"). Fix it only if it falls
out of the same code. If it does, a manifest that does not use the new key must still hash as before.

### Docs

The campaigns reference (<https://dataquail.github.io/goodbones/campaigns/>): `onAhead` on an objective, the
resolution order, `ignore`, and the case for it. Write that case by shape: _an objective that counts what is left
of a sector, which every phase's deletions pay down, is never ahead_. Do not refer to `no-hapi-files` by name.

### Tests to add

On a fixture with phases `a → b → c` and an objective `left` in `c` that counts every file in the sector:

1. Campaign `onAhead: ratchet`, `left` unset: deleting a file at phase `a` gives `ahead`, exit non-zero. This is
   today's behaviour, kept.
2. Same, with `left: { onAhead: ignore }`: verdict `ok`, no `ahead` entry in the text or the JSON.
3. `left: { onAhead: advise }` under a ratcheting campaign: listed, verdict `ok`.
4. `left: { onAhead: ratchet }` under an advising campaign: verdict `ahead`.
5. Two objectives paid down ahead, one `ignore` and one `ratchet`: one listed entry, verdict `ahead`.
6. A phase override at the judged phase still applies to an objective with no setting of its own.
7. Both nudge modes (ledger and base), as O1 was tested.
8. Hash stability: a fixture manifest with no objective `onAhead` produces the same phase hashes as beta.5.
   Adding `onAhead` to one objective changes only its phase's hash.

## Out of scope

R11 (base mode does not name a concession's move or revocation), R10 (`check` and lint judging "ahead"), and
every other deferred item. Keep the release to this change so the A/B's frozen engine differs from beta.5 by
one feature.

## Release

1. Publish `@goodbones/campaigns` `0.1.1-beta.6`. `@goodbones/cli` and `@goodbones/oxlint` depend on
   `@goodbones/campaigns` at an exact version, so republish both as `0.1.0-beta.17`, depending on beta.6.
   `core` and `typescript` stay at `0.1.0-beta.15` unless the change needs them.
2. Report the versions back.

## Then, in hapi-nest-strangler (the owner, or a session in that repo)

1. On a branch from `main`, set the three pins in the root `package.json`, run `pnpm install`, and commit
   `chore: goodbones cli/oxlint 0.1.0-beta.17, campaigns 0.1.1-beta.6`. In the same commit, update the pins
   named in `CLAUDE.md` and `.claude/rules/architecture-rules.md`. Then run `pnpm lint`, `pnpm lint:rules`,
   `pnpm lint:edges`, `pnpm lint:architecture`, `pnpm campaigns` and `pnpm test`. `campaigns:clear` must change
   no ledger and no `plan.json`.
2. A plan change, in its own commit: `onAhead: ignore` on `no-hapi-files`, plus a `concessions` entry on
   `gone` giving the reason. Then `pnpm campaigns:clear`, which records the receipt in `plan.json`. The reason
   should say: every phase's deletions pay down what is left, so paying it down is never ahead of the plan.
3. **Accept when** (from the main checkout, scratch worktree as in `harness/run.mjs`):
   - `replay-stack.mjs` with the new pins: all 14 layers exit 0, and no `no-hapi-files` appears in any
     `ahead of plan` line.
   - `run.mjs --campaign-from <the branch> --overlay-base 00f59e7 --carry-pins`, every entry. F4 is still
     caught on G1 and G2 with `ahead of plan: has-nest-endpoints −1 … routes-still-local −1 belongs to served`.
     P1 exits 0 with C1's billing block and no `ahead of plan` line. Every other row equals
     `seeded-faults-campaigns-0.1.1-beta.5.md` gate for gate.
   - Write `results/seeded-faults-campaigns-0.1.1-beta.6.md` comparing row by row with beta.5, plus the
     replay table.
4. That is gate 3 passed without R9. The freeze in `03-ab-plan-vs-campaign.md` remains the owner's call.
