# Experiment 1 — seeded faults, rerun for gate 3b

Engine: core / typescript / cli / oxlint `0.1.0-beta.15`, campaigns `0.1.1-beta.4` (unchanged from the
baseline). Date: 2026-10-06. Campaign definition: `campaign/shared-state-objectives` at `6ee2bb6`, which adds
`shared-state-split` (phase `served`) and `mirror-before-write` (phase `mirrored`) to `strangle-hapi`.
Harness: `../harness/run.mjs --campaign-from campaign/shared-state-objectives --label 3b`. Raw:
`seeded-faults-campaigns-0.1.1-beta.4-3b.json` and one folder of gate logs per entry in
`raw/campaigns-0.1.1-beta.4-3b/`. The baseline's raw output is untouched.

## What changed in the harness

`--campaign-from <ref>` overlays the campaign definition before each entry's fault. It applies the diff of
`architecture.yaml` and `campaigns/` between `<ref>` and its merge base with `main` onto the checked-out
branch (`git apply --3way`), runs `pnpm campaigns:clear`, and commits the result as the fault's base. G2 diffs
against that commit, not the branch.

The overlay applies the definition's _change_ rather than copying the files. The billing stack carries campaign
edits of its own that `main` lacks: the `shared` scaffolding globs, `grows: [hapi-lines]` on `mirrored`, and
its concession. A copy of `main`'s definition would remove them and turn the controls red for a reason that
has nothing to do with step 3b.

On every entry the overlay commit touched exactly five files: the two definition files, the two new ledgers
and `plan.json` (the receipt). Each existing objective's `clear` line reads `nothing to clear`. Example
(`F5.json`, `overlay.clear`):

```
strangle-hapi/routes-still-local: nothing to clear; 3 holdouts left.
strangle-hapi/legacy-writes: nothing to clear; 4 holdouts left.
strangle-hapi/mirror-before-write: 2 sectors entered (billing, todo); 0 holdouts left.
strangle-hapi/shared-state-split: 2 sectors entered (billing, todo); 0 holdouts left.
```

## How to read the cells

As in the baseline. **caught**: exit non-zero, and the output names the fault. advised: exit 0, and the output
names the fault. noise: exit non-zero, but not at the fault. ·: exit 0, fault not mentioned. —: not run. G4c
is the campaign's own rule inside `pnpm lint`; G4o is every other lint rule.

## Controls: every gate on each untouched branch, under the overlay

All eight branches exit 0 on G1–G7 with the new objectives in place. **No control turned red on the
definition change.**

C-retire-internal's first run failed G7 on one legacy-api test,
`organization-routes.integration.test.ts › lists members with emails, promotes, demotes, removes, and lets a
member leave`. This is the same test that failed on the baseline's first F10 run (footnote ³ there). The
overlay only touches campaign files, which no integration test reads. Rerun per protocol: all seven gates
exit 0. The first run is kept in `raw/…-3b/superseded/C-retire-internal-run1`.

## Faults

| Fault                                   | G1 nudge   | G2 CI nudge | G3 check    | G4c        | G4o        | G5 tsc | G6 unit | G7 integ. | Campaign only? | vs. baseline                          |
| --------------------------------------- | ---------- | ----------- | ----------- | ---------- | ---------- | ------ | ------- | --------- | -------------- | ------------------------------------- |
| F1 unmirrored write, `mirrored`         | advised    | advised     | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                  |
| F1b same write, `backfilled`            | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                  |
| F2 new local route after `served`       | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                  |
| F3 model left behind at `settled`       | advised    | advised     | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same (R1 still open)                  |
| F4 reads served before the backfill     | ·          | ·           | noise       | ·          | ·          | ·      | ·       | ·         | missed         | same                                  |
| F5 start flipped without cancel/webhook | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | **changed: missed → caught** (see F5) |
| F6 mirror emitted before the insert     | advised    | advised     | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | **changed: missed → caught** (see F6) |
| F7 billing re-couples to organization   | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                  |
| F8 legacy write back after cutover      | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                  |
| F9 control: Nest handler names adapter  | ·          | ·           | **caught**¹ | ·          | **caught** | noise² | ·       | ·         | no (lint)      | same                                  |
| F10 control: mirror double-charges      | ·          | ·           | ·           | ·          | ·          | ·      | ·       | ·         | missed         | same (G7 green on the first run here) |
| F11 new holdout conceded, not fixed     | · (advise) | advised⁴    | ·           | ·          | ·          | ·      | ·       | ·         | —              | same                                  |

¹ ² ⁴ As in the baseline: G3's own architecture rules, a type error caused by the edit, and G2's
`conceded on this branch` line.

Every exit code outside F5 and F6 equals the baseline's (`seeded-faults-campaigns-0.1.1-beta.4.json`, gate by
gate). The G1 and G3 logs of the other faults match the baseline text, apart from timings. Their G2 logs
differ only in the `--base` argument, which is now the overlay commit's SHA. Neither new objective appears in
the output of any entry but F5 and F6.

**Headline.** 8 of 11 faults (F1, F1b, F2, F3, F5, F6, F7, F8) are now caught by the campaign and by nothing
else; the baseline had 6. **Missed by every gate: F4, F10.** F4 is the ordering gap (O1, engine work). F10 is
the calibration fault no gate is designed to see.

### F5: start flipped without cancel and webhook

`shared-state-split` reports `billing-routes.ts#subscription-lifecycle`. The fault still pays down one
`routes-still-local` and one `legacy-writes` holdout, so the direction is `mixed`. Under `served`'s ratchet
that is `back`, and both nudges exit 1 (G1):

```
toward the next phase: routes-still-local 2 · legacy-writes 3 · shared-state-split 1
this diff: −legacy-writes: billing-service.ts#startSubscription#cff14458 · −routes-still-local: billing-routes.ts#billingRoutes#ad2a056c · +shared-state-split: billing-routes.ts#subscription-lifecycle  mixed
onTouch: ratchet — back
not ok
```

G3 changes from noise to caught. The baseline's red `check` only asked to `clear` the two paid-down entries.
It now opens with `1 new hit the ledger does not carry: shared-state-split · billing ·
billing-routes.ts#subscription-lifecycle`, followed by the same stale-entry list. G4c reports the objective's
`how` at `billing-routes.ts:40:5`, the first route of the group still served locally. The tests are unchanged
and pass, as in the baseline.

### F6: mirror emitted before the insert

`mirror-before-write` reports `billing-service.ts#startSubscription`. Billing stands at `mirrored`, which is
`onTouch: advise` by design (the legacy module grows there). So both nudges name the fault and exit 0. This is
the same behaviour F1 shows at that phase:

```
this diff: +mirror-before-write: billing-service.ts#startSubscription#16aee292  back
onTouch: advise — ok
```

`check` (G3) fails with `1 new hit the ledger does not carry`, and the campaign rule in lint (G4c) fails at
`billing-service.ts:89:5`. A CI job that runs only the nudge would let F6 through, as it lets F1 through. The
gate that stops both is `lint:architecture` (or `pnpm lint`). If the owner wants the nudge itself to stop F6,
it takes an `onTouch` per objective (the engine has none) or moving the objective to a ratcheting phase. The
second would take a misordered emit out of the `mirrored` window where it is made.

## Probes

| Probe | vs. baseline                                                                               |
| ----- | ------------------------------------------------------------------------------------------ |
| P1    | same: G1/G2 exit 0, no billing block                                                       |
| P2    | same: `attest` 0, `clear` 0, `billing went back settled → served`                          |
| P3    | same: 600 characters written, 500 stored                                                   |
| P4    | same exits: `campaigns` 0, `status --json` 1, `campaigns billing` 1, `campaigns --json` 0  |
| P5    | same: G1/G2 `neutral`, exit 0; G3 `2 new hits` + `2 ledger entries no longer fire`, exit 1 |

## Verdicts that changed

- **F5**: missed → caught (G1, G2, G3, G4c). Intended.
- **F6**: missed → caught (G3, G4c), advised on G1/G2. Intended.
- **Nothing else.** C-retire-internal's first-run G7 failure was the known flaky organization-routes test.
  It passed on rerun and is not counted, per protocol.

## Gate 3b

F5 and F6 are caught. No other fault, probe or control changed its verdict. The freeze (engine pins and the
campaign definition's commit at the top of `03-ab-plan-vs-campaign.md`) is the owner's call and is not made
here.
