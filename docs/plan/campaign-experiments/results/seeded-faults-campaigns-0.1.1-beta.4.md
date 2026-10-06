# Experiment 1 — seeded faults, baseline

Engine: core / typescript / cli / oxlint `0.1.0-beta.15`, campaigns `0.1.1-beta.4`. Date: 2026-10-06.
Harness: `../harness/` (`run.mjs`, `entries.mjs`, `patches/F5.patch`). Raw: `seeded-faults-campaigns-0.1.1-beta.4.json`
and one folder of gate logs per entry in `raw/campaigns-0.1.1-beta.4/`.

## How to read the cells

| Cell       | Meaning                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| **caught** | exit non-zero, and the output names the fault                                                             |
| advised    | exit 0, and the output names the fault (the nudge under `onTouch: advise`, or a rule that let it through) |
| noise      | exit non-zero, but not at the fault: asks you to `clear` ledgers, or a side effect of the edit            |
| ·          | exit 0, fault not mentioned                                                                               |
| —          | not run for this entry                                                                                    |

**G4 is split.** `pnpm lint` carries the campaign's own oxlint rule (`architecture(campaigns)`), so a red lint
is not automatically an independent gate. G4c is the campaign rule inside lint; G4o is every other lint rule.

## Controls: every gate on each untouched branch

All eight branches the faults use (`mirror-cancel`, `mirror-start`, `backfill`, `attest`, `serve-read`,
`serve-writes-nest`, `retire-internal`, `data-moved`) exit 0 on G1–G7. So any red cell below comes from the fault.

## Faults

| Fault                                   | G1 nudge      | G2 CI nudge   | G3 check    | G4c        | G4o        | G5 tsc | G6 unit | G7 integ. | Campaign only? | Prediction held?                       |
| --------------------------------------- | ------------- | ------------- | ----------- | ---------- | ---------- | ------ | ------- | --------- | -------------- | -------------------------------------- |
| F1 unmirrored write, `mirrored`         | advised       | advised       | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | yes                                    |
| F1b same write, `backfilled`            | **caught**    | **caught**    | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | yes                                    |
| F2 new local route after `served`       | **caught**    | **caught**    | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | yes                                    |
| F3 model left behind at `settled`       | advised       | advised       | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | **no**: the nudge exits 0 (finding R1) |
| F4 reads served before the backfill     | ·             | ·             | noise       | ·          | ·          | ·      | ·       | ·         | missed         | yes, missed by every gate              |
| F5 start flipped without cancel/webhook | · (`forward`) | · (`forward`) | noise       | ·          | ·          | ·      | ·       | ·         | missed         | yes, missed; read as progress          |
| F6 mirror emitted before the insert     | ·             | ·             | ·           | ·          | ·          | ·      | ·       | ·         | missed         | yes                                    |
| F7 billing re-couples to organization   | **caught**    | **caught**    | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | yes (and see R3)                       |
| F8 legacy write back after cutover      | **caught**    | **caught**    | **caught**  | **caught** | ·          | ·      | ·       | ·         | yes            | yes                                    |
| F9 control: Nest handler names adapter  | ·             | ·             | **caught**¹ | ·          | **caught** | noise² | ·       | ·         | no (lint)      | yes                                    |
| F10 control: mirror double-charges      | ·             | ·             | ·           | ·          | ·          | ·      | ·       | ·³        | missed         | yes                                    |
| F11 new holdout conceded, not fixed     | · (advise)    | advised⁴      | ·           | ·          | ·          | ·      | ·       | ·         | —              | yes; see R2                            |

¹ G3's own architecture rules caught it (`commands/imports` and the graph rule `use-cases-reach-no-adapter`), not its campaign part.
² The fault narrows the injected field's type, so the handler test that passes a fake no longer compiles. The type error comes from the edit, not from the boundary.
³ First run: one unrelated organization-routes test failed. Rerun per protocol: all green. The first run is kept in `raw/…/superseded/F10-run1`.
⁴ G2 prints `conceded on this branch, in the ledger: writes-not-mirrored: billing-service.ts#touchSubscription#72849c2e` and exits 0. G1 says nothing about the concession.

**Headline.** 6 of 11 faults (F1, F1b, F2, F3, F7, F8) are caught by the campaign and by nothing else. On
F9 the campaign adds nothing beyond the architecture rules. **Missed by every gate: F4, F5, F6, F10.** The
four non-campaign gates (G4o–G7) catch only F9, the control built for them. The tests caught none of the
strangling mistakes.

**Advised, not failed.** Locally the nudge names F1 and F3 but exits 0, so a CI job running it would let
both through. F1 is designed to pass, since `mirrored` is `onTouch: advise`. F3 is not designed to pass (R1).
`lint:architecture` (G3) and the campaign rule inside `pnpm lint` still fail on both.

## Probes

| Probe | Fix | Output (verbatim, trimmed)                                                                                                                                                                                                     | Matches baseline?                                                                |
| ----- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| P1    | C1  | G1: only `legacy — phase fenced … onTouch: ratchet — ok`. G2: `legacy at phase fenced (1 of 9) · nothing in your files, diff neutral`. No billing block, though the diff deletes `billing-routes.ts` and its integration test. | yes                                                                              |
| P2    | C2  | attest: `Run objectives clear to move it on.` clear: `has-nest-endpoints / routes-still-local / legacy-writes: 1 sector entered (billing)` … `billing went back settled → served.`                                             | yes: a forward move reported as "went back" from a phase billing was never at    |
| P3    | C3  | `note left on billing`; 600 characters written, 500 stored, end marker gone, no warning                                                                                                                                        | yes                                                                              |
| P4    | C4  | `campaigns`: campaign-wide counts (`served 1`), never naming which sector; `status --json` → `campaigns status takes --changed`; `campaigns billing` → `ENOENT … wt-faults/billing`; `campaigns --json` prints the text report | yes, plus R6                                                                     |
| P5    | C6  | G1/G2: `−legacy-writes: …#applied#03ade66f · −…#applied#5a2b4f97 · +…#outcome#03ade66f · +…#outcome#5a2b4f97  neutral`, exit 0. G3: `2 new hits the ledger does not carry` + `2 ledger entries no longer fire`, exit 1         | partly: the nudge calls the rename neutral; `check` fails it as two new holdouts |
| P6    | O1  | = F4: silent on every gate                                                                                                                                                                                                     | yes                                                                              |

## Findings (refuted predictions and things the run turned up)

Corrected the same day after a review against the engine source (`campaigns@0.1.1-beta.4`). R1, R2 and R4
first gave causes the code does not bear out; each entry below says what changed.

- **R1 — A settled sector can regress and the nudge passes it (F3).** Billing derives back from `settled`
  to `data-moved`. Both nudge modes print `onTouch: ratchet (of settled) — ok`, `ask: note`, and exit 0.
  The prediction was `back`, non-zero. Cause: `settled` is an open phase (an intent, no objectives).
  `host/nudge.ts:495` sets `ask = "note"` for an open phase and never assigns a verdict, so it stays `ok`
  although `back` was computed. Only `check` and the campaign lint rule fail. _Corrected:_ the
  `mixed`/`back` label difference between the modes is by design (ledger mode compares against the recorded
  31 lines, base mode against the base tree's 11). It is not part of the bug.
- **R2 — A concession can move a sector back a phase, and the local nudge does not show it (F11).** On
  the F1b fault, `clear` printed `billing went back backfilled → mirrored`. That is a message only:
  `reachedRecord` (`core/ledger.ts:819`) never moves `reached` backward. The `concede` that followed is what
  dropped billing to `mirrored` in ledger mode: it put a `writes-not-mirrored` holdout into the ledger, and
  the ledger-mode phase is derived from the ledgers. G1 then judges billing at `mirrored` (`onTouch: advise
— ok`) and never mentions the concession. Only G2 (base mode) shows it. _Corrected:_ first written as
  "`clear` records the backward move".
- **R3 — `check` tells you to clear the entries of a phase the sector just fell behind (F7).** With one new
  coupling, billing drops from `served` to `fenced`. `lint:architecture` then lists **7** served-phase
  entries as `no longer fire, or fire past their window … clear them`. The engine treats "not in window" as
  "past the window" even when the sector is _behind_ it (`domain/report.ts`, `clear`'s `!inWindow` branch).
  Per the review, following the advice closes those entries, and their initial, cleared and conceded counts
  restart when the sector comes back. I have not reproduced that part. The five-phase drop itself is correct
  behaviour, since a sector's phase is the lowest objective due; at most the nudge could also print what was
  reached.
- **R4 — Work done ahead of its phase is invisible (F4); shared state flipped separately reads as progress
  (F5).** _Corrected:_ first written as "`check` pushes toward the mistake", which does not hold. F4's red
  `check` comes from the shared `hapi-lines` measure (97 → 157, measured, not held), which is ordinary
  bookkeeping unrelated to billing. The fault itself is invisible everywhere. F5's red `check` is real: two
  in-window holdouts were paid down, and "clear them" is the right advice. F5 is a fault of meaning, not of
  ledgers. **F4 confirms the ordering gap (O1).** F5 and F6 can be written as campaign objectives with
  existing terms (a sector-level `fn`/match over "start, cancel and webhook all local or all proxied"; an
  ast-grep `syntax` rule with `precedes`/`follows` for the emit after the insert). No engine change is
  needed.
- **R5 — `pnpm lint` is not independent of the campaign.** It runs `architecture(campaigns)`, so every
  campaign-caught fault also turns lint red. The plan's predictions (`G4–G7 pass`) assumed otherwise. That
  is deliberate engine parity, not a bug. The table splits G4, and the write-up should not count lint as a
  separate gate for these faults.
- **R6 — The CLI ignores some arguments without saying so (P4).** `campaigns --json` prints the text
  report. `campaigns billing` treats `billing` as a path and fails with `ENOENT`. Both belong with C4.
- **R7 — The holdout key moves with the binding, and only `check` objects (P5).** A rename is `neutral` in
  the nudge but two new holdouts plus two stale entries in `check`. The content hash survives the rename
  (`#applied#03ade66f` → `#outcome#03ade66f`), so pairing on (file, hash) across anchors would absorb it.
  The F2 and F5 keys show the same keying: a route's holdout is `billingRoutes#<hash>`, not the route.
- **R8 — Harness/repo, not engine: the Nest integration setup only migrates the legacy schema.**
  `packages/server/src/test-utils/global-setup.ts` runs `db:migrate:test` for the legacy tables. On a
  database that a later branch has migrated (the `data-moved` drop migration), knex refuses and the Nest
  suite aborts. The harness now resets the legacy schema before G7. `C-serve-writes-nest` and `F4` were
  rerun with that fix, and their first runs are in `raw/…/superseded/`. The same hazard hits anyone who
  switches branches across the stack with one test DB.
- **P2/C2 cause (from the review).** `ledgerPhaseOf` reads an objective the sector never entered as 0, so
  it reads straight past phases with no ledger entries. That is how `settled → served` came out.
- **P3 addendum (from the review).** Besides the 500-character cut, notes past the 20th silently drop the
  oldest.

## What this means for gate 1

- C1–C4 stay in as planned. P1–P4 reproduce exactly. C2's cause is above.
- **Add O1**, because F4 is missed by every gate. Its scope is the owner's call: in base mode the base
  side's per-sector objective counts are already cached, so O1 is nearly free there; ledger mode would need
  a cached evaluation of HEAD, or O1 only works in CI.
- Engine bugs with confirmed causes: **R1** (apply the ratchet verdict to what went back, even in an open
  phase), **R3** (separate behind-the-window from past-the-window; entries behind it are held, not stale),
  **R2** (ledger mode lists concessions made in the working tree; `concede` says when it sends a sector back
  a phase).
- **C6 (R7)** is cheaper than feared: a fallback reconcile pass on (file, hash), with no re-keying.
- **Not engine work:** F5/F6 (expressible as objectives; see below), F10 (calibration), R5 (by design), R8
  (this repo).

## Consequence for experiment 2

F5 and F6 can be expressed with today's terms, so "ordering is what a document is good at and a detector
is not" is weaker than the README states.

**Decided (owner, 2026-10-06): add them to the campaign.** The campaign covers every hapi sector, not only
billing, and the A/B scores on organization, a sector these faults were not drawn from. The conditions:

- Written by shape, not by billing's names: "a write's mirror emit follows the write" (F6), and "the
  operations of a shared-state group are all local or all proxied" (F5). For organization, the groups come
  from the A/B plan's Appendix A.
- Arm A's plan document states the same groups and ordering rules, so the arms differ only in whether the
  rules are checked.
- Added before the pilot, and frozen with the engine version.
- Since these objectives sit close to the auditor's invariants I1 and I2, the auditor keeps its independent
  method, and the write-up says the campaign was extended after experiment 1.
