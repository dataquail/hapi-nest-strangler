# Experiment 1 — seeded faults, rerun on the fixed engine (gate 3)

Engine: core / typescript `0.1.0-beta.15`, cli / oxlint `0.1.0-beta.16`, campaigns `0.1.1-beta.5`. Date:
2026-10-06. Campaign definition: `main` at `ece6748`: step 3b's `shared-state-split` and
`mirror-before-write`, plus `onAhead: ratchet`. Harness: `../harness/run.mjs --campaign-from ece6748
--overlay-base 00f59e7 --carry-pins`. Raw: `seeded-faults-campaigns-0.1.1-beta.5.json` and one folder of gate
logs per entry in `raw/campaigns-0.1.1-beta.5/`. Stack replay: `../harness/replay-stack.mjs`, raw in
`raw/campaigns-0.1.1-beta.5-replay/stack.json`.

Step 3b ran before this step (on beta.4, see `seeded-faults-campaigns-0.1.1-beta.4-3b.md`), so this run tests
the fixed engine and the extended definition together. Each row is compared with two earlier runs: **3b** (same
definition, old engine) for regressions, and the **baseline** for the rows the fixes target.

## What changed in the harness

- **The overlay carries the engine.** The billing branches pin beta.15 / beta.4 and fork from `00f59e7`.
  `--overlay-base 00f59e7` diffs `architecture.yaml` and `campaigns/` from that fork point to `ece6748`, and
  `--carry-pins` sets the five `@goodbones/*` pins from `ece6748`'s `package.json` and runs a non-frozen
  `pnpm install` before `campaigns:clear`. Every entry records the installed versions; all 26 read beta.5.
  The base is explicit because the local `main` ref still stands at `00f59e7`.
- **The overlay changed no existing ledger.** On every entry the overlay commit touched seven files: the two
  definition files, `package.json`, `pnpm-lock.yaml`, the two new ledgers and `plan.json`. Every existing
  objective's `clear` line reads `nothing to clear`, as `02-engine-fixes.md` (release step 3) predicts.
- **New observations, unchanged faults.** P4 adds `status --sector billing` (text and `--json`). F7 runs a
  `clear` after the gates and records the ledger diff (R3). F11 reads back `sectors/billing.json` and
  `status --sector`. Every fault's edit is byte-identical to the baseline's.
- **F11b is new** (R2's revocation; see below). It has no earlier row.

## How to read the cells

As in the baseline. **caught**: exit non-zero, and the output names the fault. advised: exit 0, and the output
names the fault. noise: exit non-zero, but not at the fault. ·: exit 0, fault not mentioned. —: not run. G4c
is the campaign's own rule inside `pnpm lint`; G4o is every other lint rule.

## Controls

All eight branches exit 0 on G1–G7 under the overlay. C-backfill failed G7 twice on one legacy-api test,
`organization-routes.integration.test.ts › lists members with emails, promotes, demotes, removes, and lets a
member leave`. It is the same test as the 3b and baseline flakes: the member list arrives in a different row
order than the test expects. The third run passed all seven gates. Runs 1 and 2 are kept in
`raw/…/superseded/`. See R12.

## Faults

| Fault                                   | G1 nudge   | G2 CI nudge | G3 check    | G4c        | G4o        | G5 tsc | G6 unit | G7 integ. | Campaign only? | vs. 3b                                   | vs. baseline         |
| --------------------------------------- | ---------- | ----------- | ----------- | ---------- | ---------- | ------ | ------- | --------- | -------------- | ---------------------------------------- | -------------------- |
| F1 unmirrored write, `mirrored`         | advised    | advised     | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                     | same                 |
| F1b same write, `backfilled`            | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                     | same                 |
| F2 new local route after `served`       | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                     | same                 |
| F3 model left behind at `settled`       | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | **changed: nudges advised → caught**     | fixed (R1)           |
| F4 reads served before the backfill     | **caught** | **caught**  | noise       | ·          | ·          | ·      | ·       | ·         | yes            | **changed: nudges missed → caught**      | fixed (O1); see R10  |
| F5 start flipped without cancel/webhook | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                     | caught since 3b      |
| F6 mirror emitted before the insert     | advised    | advised     | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same                                     | caught since 3b      |
| F7 billing re-couples to organization   | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same verdicts; `check` lists no stale    | fixed (R3)           |
| F8 legacy write back after cutover      | **caught** | **caught**  | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | same verdicts; `check` lists no stale    | R3 shows here too    |
| F9 control: Nest handler names adapter  | ·          | ·           | **caught**¹ | ·          | **caught** | noise² | ·       | ·         | no (lint)      | same                                     | same                 |
| F10 control: mirror double-charges      | ·          | ·           | ·           | ·          | ·          | ·      | ·       | ·         | missed         | same                                     | same                 |
| F11 new holdout conceded, not fixed     | advised    | advised     | ·           | ·          | ·          | ·      | ·       | ·         | —              | **changed: G1 now names the concession** | fixed (R2 a, b)      |
| F11b conceded across an attested phase  | advised    | advised     | ·           | ·          | ·          | ·      | ·       | ·         | —              | new                                      | new (R2, revocation) |

¹ ² As in the baseline: G3's own architecture rules, and a type error caused by the edit.

**Headline.** 9 of 11 faults (F1, F1b, F2, F3, F4, F5, F6, F7, F8) are caught by the campaign and by nothing
else. The baseline caught 6, step 3b caught 8. **Missed by every gate: F10 only**, the calibration fault no gate
is designed to see. Locally, the nudge now gates F1b, F2, F3, F4, F5, F7 and F8. F1 and F6 are advised there, by
design (`mirrored` is `onTouch: advise`); `lint:architecture` and `pnpm lint` stop both.

### F3 (R1): a regression at an open phase now fails the nudge

```
this diff: +no-hapi-files: subscription-model.ts · +no-hapi-models: subscription-model.ts  back
went back at an open phase, held by the phase that named it: no-hapi-files (gone, ratchet) · no-hapi-models (data-moved, ratchet)
onTouch: ratchet (of settled) — back
ask: note
not ok
```

Both modes exit 1, and `ask` still reads `note`, as the acceptance asks. Ledger mode labels the diff `mixed`,
base mode `back`; the baseline found that difference by design.

### F4 (O1): work ahead of its phase is refused in both nudge modes

```
ahead of plan: has-nest-endpoints −1 belongs to served · routes-still-local −1 belongs to served; billing is at backfilled (not yet attested) — onAhead: ratchet
onTouch: ratchet — ahead
not ok
```

O1 was scoped to the nudge, and both modes have it. `check` (G3) and the campaign rule in lint (G4c) do not
judge "ahead". G3's red line is still only the shared `hapi-lines` measure, byte for byte as in 3b, so it stays
noise. See R10.

### F7 and F8 (R3): behind the window is held, not stale

F7's `check` now lists only the two new `no-cross-module-reach` hits. It no longer lists the 7 served-phase
entries it asked to clear in the baseline and in 3b. The `clear` run after the gates prints `billing went back
served → fenced` and leaves `.architecture-campaigns/` unchanged (`git diff HEAD` empty), so the entries
are held. F8 shows the same fix: its `check` no longer lists `no-hapi-routes · billing · billing-routes.ts` as
stale after billing falls from `routes-moved` to `served`.

### F11 (R2 a, b): the concession is visible where it is made

`concede` prints `this concession moves billing back backfilled → mirrored.`, and the local nudge, which said
nothing in the baseline, now prints:

```
conceded in the working tree, in the ledger: writes-not-mirrored: billing-service.ts#touchSubscription#72849c2e
the concession sends billing back backfilled → mirrored
onTouch: ratchet (of backfilled) — ok
```

Exit 0 is by design: a concession is the sanctioned route, and the nudge's job is to show it to a reviewer.
F11 crosses no live attestation, because on `billing-backfill` the backfill is not yet attested.

### F11b (R2, revocation): a concession across an attested phase revokes it

The owner's decision (2026-10-06) is that a concession that sends a sector below an attested phase goes
through and revokes that attestation, so in practice the phase must be attested again. F11 cannot show this, so
F11b plants a mirrored-phase holdout on `billing-attest`, where billing is at `served` with `backfilled`
attested. The holdout is F6's misordered emit, conceded as `mirror-before-write`. The unmirrored write of F11
cannot serve here: `writes-not-mirrored` closes at `served` (`until: served`), so at `served` that write is only
a `legacy-writes` holdout, and conceding it keeps billing at `served`. A misordered mirror after the backfill is
also the case where the attestation really no longer holds.

- `concede`: `this concession moves billing back served → mirrored. It revokes billing's attestation of
backfilled: what was attested no longer holds. Once it does again, attest it anew: architecture campaigns
attest billing backfilled --reason "…" --campaign strangle-hapi`.
- `sectors/billing.json`: the attestation is kept, with
  `"revoked": { "at": …, "by": …, "reason": "conceded mirror-before-write: temporary" }`.
- `status --sector billing`: `phase mirrored (3 of 9), reached served`, then the attestation with
  `(revoked 2026-10-06 …: conceded mirror-before-write: temporary)`.
- G1: `the concession sends billing back served → mirrored, and revokes the attestation of backfilled: what
was attested no longer holds, so attest it again once it does`. Exit 0.
- G2 (base mode) prints `conceded on this branch, in the ledger: mirror-before-write: …` but neither the
  move nor the revocation. See R11.

## Probes

| Probe | Fix    | Output (verbatim, trimmed)                                                                                                                                                                                                                                                                                                                                                                                         | vs. baseline                                       |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| P1    | C1     | Both modes: a billing block with `this diff moves it from routes-moved`, `this diff: −no-hapi-routes: billing-routes.ts  forward`, `now counted: no-hapi-models 2 · legacy-table-dropped 1 — in window from data-moved, not growth`. **Also** `ahead of plan: no-hapi-files −2 belongs to gone; billing is at data-moved`, `— ahead`, exit 1                                                                       | C1 fixed; **new false refusal from O1** (R9)       |
| P2    | C2     | attest, then clear: `billing moved backfilled → served.`                                                                                                                                                                                                                                                                                                                                                           | fixed                                              |
| P3    | C3     | `a note is at most 500 characters, and this one is 600: split it, or say less. Nothing was recorded.` exit 1; nothing stored                                                                                                                                                                                                                                                                                       | fixed (the 21st-note cap is not exercised here)    |
| P4    | C4, R6 | `status --sector billing`: `phase served (5 of 9)`, the backfilled attestation, `routes-still-local — 3 holdouts in window` with `billing-routes.ts:28/50/62`, `legacy-writes — 4` with their lines, `hapi-lines: 703 (held to 712, tolerance 20)`. `status --json` and `campaigns --json` print JSON. `campaigns billing`: `billing is not a path … It names a sector: campaigns status --sector billing`, exit 1 | fixed                                              |
| P5    | C6     | G1/G2 exit 0, nothing new or cleared; G3 `639 files, 0 violations`, exit 0                                                                                                                                                                                                                                                                                                                                         | fixed (G3 was `2 new hits` + `2 … no longer fire`) |
| P6    | O1     | = F4: caught by G1 and G2                                                                                                                                                                                                                                                                                                                                                                                          | fixed                                              |

P4 still names the two webhook writes `applied`: a holdout's location is its nearest binding. C6 pairs a
renamed binding without re-keying it, as the brief specified.

## The stack replay: does the campaign refuse legitimate work?

The controls have no diff, so they cannot show the campaign refusing legitimate work. P1 did: it is the real
`routes-moved` layer's code, and O1 refused it. So `replay-stack.mjs` judges each of the billing stack's 14 layers
against its parent, both under the same overlay, with the CI nudge (base mode). It shows what CI would have
said of the stack had it been built on this engine and definition.

| Layer                                      | Exit  | Verdict                                                                       |
| ------------------------------------------ | ----- | ----------------------------------------------------------------------------- |
| `fenced`                                   | **1** | `ahead of plan: no-hapi-files −1 belongs to gone; organization is at fenced`  |
| `rebuilt` … `serve-writes-nest` (8 layers) | 0     | ok (`advise — ok` in the mirrored layers)                                     |
| `serve-writes-proxy`                       | **1** | `ahead of plan: no-hapi-files −7 belongs to gone; billing is at routes-moved` |
| `retire-internal`                          | 0     | ok                                                                            |
| `routes-moved`                             | **1** | `ahead of plan: no-hapi-files −2 belongs to gone; billing is at data-moved`   |
| `data-moved`, `settled`                    | 0     | ok                                                                            |

**3 of 14 legitimate layers are refused**, all by the same objective. `no-hapi-files` counts every file left in a
sector's hapi folder and belongs to `gone`, the second-to-last phase. Any layer that deletes a hapi file
before `gone` therefore pays down `no-hapi-files` "ahead of plan". A strangler deletes files from `fenced` on:
`fenced` moved `organization-access.spec.ts` out of organization's folder into `src/lib/access/` (a
rename, so organization's count fell), `serve-writes-proxy` deleted the legacy service and its scaffolding,
and `routes-moved` deleted the route file and its test. See R9.

## Findings

Numbered after the baseline's R1–R8.

- **R9: O1 refuses ordinary deletions, through `no-hapi-files` (P1, stack replay).** Under `onAhead: ratchet`,
  three of the stack's fourteen layers fail the CI nudge, and P1 fails both modes. F4's catch and these
  refusals come from the same mechanism. `no-hapi-files` is a catch-all count of what is left, and paying it
  down is never "ahead"; the other objectives' holdouts are not like that. Options, for the owner:
  1. **Engine:** an objective-level `onAhead` (or `ahead: ignore`), set on `no-hapi-files`. This is the
     smallest change, keeps F4 refused, and needs a beta.
  2. **Campaign:** `onAhead: advise`. No release, but F4 goes back to advised in the nudge, and with R10 no
     gate fails it.
  3. **Campaign:** narrow `no-hapi-files` to files no other objective counts. This is hard to express, and it
     changes what `gone` means.

  The A/B should not start under ratchet as it stands. Arm B's agent would be refused at the same layers the
  billing agent completed correctly, and the scoring would count a false positive as campaign overhead.

- **R10: "ahead" is judged only by the nudge.** `check` and the lint campaign rule do not see F4. That matches
  O1's scope, and this repo's CI runs the nudge (`0082ad8`). A CI that ran only `lint:architecture` would still
  miss F4.
- **R11: base mode does not name what a concession moved or revoked (F11b).** The CI nudge lists the concession
  but not `served → mirrored` or the revoked attestation. The revocation is still visible to a reviewer as a
  change to `sectors/billing.json` in the diff. Minor; `02-engine-fixes.md` asked only for the ledger-mode half.
- **R12: the organization members test is order-dependent (repo, not engine).** One failure in the baseline,
  one in 3b, two here, every time on the members list's row order. The fix is an `ORDER BY` in the query or a
  sort in the test. It does not touch any verdict, but it costs a rerun.

## Gate 3

- Every fault caught on 3b is still caught, with the same exit codes on every gate. F3, F4 and F7 now behave as
  R1, O1 and R3 say. F11 and F11b show R2 (a), (b) and the revocation. P1–P6 show the intended outputs.
- **But O1 brings a regression that the controls could not see:** legitimate deletions are refused (R9). Gate 3
  passes as written. The freeze should wait for the owner's choice on R9, since every option changes either the
  engine or the definition that `03-ab-plan-vs-campaign.md` would freeze.
