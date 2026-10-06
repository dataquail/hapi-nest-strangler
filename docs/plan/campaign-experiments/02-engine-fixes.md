# Step 2 — Engine fixes before the A/B

Part of the programme in `README.md`. This is a brief for a session working in the **goodbones**
repository (`dataquail/goodbones`), to be issued after experiment 1's baseline (gate 1) and
before its rerun. It is self-contained. The evidence behind each item is in
`docs/plan/campaign-rough-edges-billing.md` of `dataquail/hapi-nest-strangler` (entries B1–B21) and in
experiment 1's baseline, `docs/plan/campaign-experiments/results/seeded-faults-campaigns-0.1.1-beta.4.md`
(faults F1–F11, probes P1–P6, findings R1–R8, with every gate's log under `results/raw/`). Every
reproduction below names a branch of that repo's billing stack (GitHub stack #35).

**Revised after gate 1 (2026-10-06).** The baseline confirmed C1–C4 and F4, which makes O1 required. It also
found three engine bugs (R1, R2, R3, added below), and a review against the source made C6 cheaper than
first feared. F5 and F6 are not engine work: they become campaign objectives in this repo (README, step
3b).

## Why these, and only these

Experiment 2 puts a campaign-guided agent through cold restarts, handoffs and a second
contributor. The fixes below are the ones that distort what that agent sees at exactly those
moments; leaving them in would bias the A/B against the campaign for reasons unrelated to the
idea. Everything else in the findings log (C5, C7–C10, the documentation items) is deliberately
deferred: none changes what an agent does mid-sector. Also out of scope: F10 (calibration, beyond every
gate by design), R5 (lint running the campaign rule is deliberate parity), R8 (this repo's test setup).

**Do not change semantics that experiment 1 relies on.** A1 (window entry is not growth), A2
(concessions honoured in base mode, `grows`), A3 (`shared`) and A4 (phase-weighted headline) are
verified on billing; the rerun of experiment 1 checks they still hold.

## Engine version this brief was written against

`@goodbones/{core,typescript,cli,oxlint}` `0.1.0-beta.15`, `@goodbones/campaigns` `0.1.1-beta.4`.
Source paths below are inside `@goodbones/campaigns/src`.

## The fixes

### C1 — a diff's deleted files belong to their sectors _(required)_

- **Problem.** A diff that only deletes a sector's files produces no block for that sector in the
  nudge. From `served` on, a strangler sector finishes by deletion, so the diffs that advance it
  are the ones the nudge does not show (B15).
- **Cause.** `host/nudge.ts` ~253–259 builds the touched sectors from `diff.touched` only;
  `diff.deleted` is consulted solely for deleted markers (un-births).
- **Change.** Resolve each deleted file against the **base side's** sector index (the file exists
  there) and include that sector; list the deleted files' holdouts as removed (`−`) in `this diff`.
- **Reproduce.** Branch `campaign/billing-routes-moved`, then `architecture campaigns status
--changed --base campaign/billing-retire-internal packages`.
- **Accept when.** Probe P1 shows a billing block with `this diff moves it from routes-moved`,
  `−no-hapi-routes: billing-routes.ts  forward` and `now counted: no-hapi-models 2 ·
legacy-table-dropped 1`, in both ledger and base mode.

### C2 — `clear` reports the move it made, not a regression _(required)_

- **Problem.** Right after `campaigns attest billing backfilled`, `objectives clear` prints
  `billing went back settled → served`. The sector moved _forward_ from `backfilled`; "went back"
  is the regression word (B9).
- **Cause (confirmed).** `host/clear.ts` ~316 (`sectorMovesOf`) takes `from` from `ledgerPhaseOf`.
  `ledgerPhaseOf` reads an objective the sector has never entered as 0, so it reads straight past
  phases the sector has no ledger entries for.
- **Change.** In `ledgerPhaseOf`, count a never-entered objective as met only for phases up to the
  record's `reached`, the phases passed through in one `clear`. Past `reached` it is residue. This
  also makes ledger mode judge a sector from the right phase in general, not only in `clear`'s message.
- **Reproduce / accept.** Probe P2: on `campaign/billing-backfill`, attest, clear → `billing moved
backfilled → served`.

### C3 — a note is never cut silently _(required)_

- **Problem.** `campaigns note` stores the first 500 characters and reports success. Both settled
  notes in the repo (todo's, billing's first) were cut mid-sentence (B18).
- **Cause.** `core/ledger.ts:843` `NOTE_LENGTH = 500`, applied by `text.slice(0, NOTE_LENGTH)`. A
  second silent loss sits beside it: `NOTE_CAP = 20` with `.slice(-NOTE_CAP)` quietly drops the oldest
  notes once there are more than 20.
- **Change.** Refuse rather than store: an over-long note is refused with the limit and the length in
  the message, and a 21st note is refused naming the cap (the author prunes or splits on purpose).
  Never truncate or drop quietly.
- **Accept when.** Probe P3: a 600-character note is refused with a message naming 500 and 600, and
  nothing is stored cut. A 21st note on a fixture holding 20 is refused, and all 20 remain.

### C4 — a per-sector view _(required)_

- **Problem.** No command answers "where is this sector and what holds it". `campaigns status`
  aggregates each objective over all sectors; `status --json` without `--changed` refuses; a fresh
  agent finds its sector by reading `sectors/<name>.json` and the objective ledgers, or by guessing
  a file to `explain` (B1). Experiment 2's cold-start and handoff disturbances test exactly this
  question.
- **Change.** `architecture campaigns status --sector <name>` printing: the phase (and attested
  state), the phase intent, every in-window holdout with its location and the objective's `how`,
  each measure with recorded and tolerance, and the sector's notes. Also: `status --json` works
  without `--changed` and includes a per-sector array. A row per sector in the default table is
  welcome but optional.
- **Also (R6).** Two arguments are mishandled without a word: `architecture campaigns --json packages`
  prints the text report, and `architecture campaigns billing packages` treats `billing` as a path
  (`ENOENT`). Make `--json` work on the bare command, and refuse a positional that is not an existing
  path, naming `--sector` when it matches a sector.
- **Accept when.** Probe P4: on `campaign/billing-serve-read`, `campaigns status --sector billing`
  shows `served`, `routes-still-local 3` with the three route locations, `legacy-writes 4` with
  theirs, and the measure.

### C6 — a rename does not re-key a holdout _(required; cheaper than feared)_

- **Problem.** A holdout's key is the nearest enclosing _binding_. Renaming `const applied = …` to
  `outcome` in `ingestStripeWebhook` reads as two cleared and two new `legacy-writes` holdouts (B16, P5,
  R7). The nudge calls it `neutral`, but `check` fails with `2 new hits` and `2 ledger entries no longer
fire`, which costs a `concede` and a `clear` per rename.
- **Cause.** The anchor changes (`#applied#03ade66f` → `#outcome#03ade66f`) while the content hash
  survives. `reconcileSector` already pairs entries that drifted under the same anchor, but not across
  anchors. Base mode does not reconcile at all.
- **Change.** Add a fallback pass in `reconcileSector` that pairs an unmatched vanished entry with an
  unmatched new one on (file, objective, hash) across anchors, carrying the ledger entry over to the new
  key. Use the same reconcile in base mode. No new key scheme, so no re-keying and no migration.
- **Accept when.** Probe P5 (now run through G1–G3): the nudge reports nothing new or cleared, and
  `lint:architecture` passes on the rename with no `concede` and no `clear`.

### O1 — work done ahead of its phase _(required: F4 confirmed missed by every gate)_

The baseline confirmed it: F4 (reads served before the backfill is attested) is silent on all seven gates.
The only red line, `check`'s, is unrelated bookkeeping on the shared `hapi-lines` measure. This is the most
important item in the brief: an A/B without it compares a campaign with a known hole to a document
without one.

- **Problem.** A diff that pays down holdouts of an objective whose window the sector has not
  entered yet is neither counted nor flagged. Serving reads (`routes-still-local`,
  `has-nest-endpoints`, phase `served`) while the sector is still at `backfilled` — before the
  backfill is attested — passes silently (F4).
- **Change.** In the nudge, compare base and head hits for objectives **ahead** of the sector's
  window as well (`explain` already evaluates them). When a diff removes hits of an objective whose
  window opens at a later phase than the sector's base-side phase, report:
  `ahead of plan: routes-still-local −1 belongs to served; billing is at backfilled (not yet
attested)`. Its weight is a manifest choice: `onAhead: advise | ratchet` on the
  campaign, overridable per phase, default `advise`. Under `ratchet` the nudge exits non-zero.
- **Edge cases to decide and document.** Removing a hit that belongs to an objective with no
  window for this sector (never named by any phase) is not "ahead". Attested phases count as not
  reached until attested. A diff that both completes the current phase and starts the next is
  judged against the base side (consistent with A1).
- **Scope: the owner decides before this session starts.** In **base mode** it is nearly free: the base
  side already caches every objective's count per sector (`core/campaign-state.ts:242`), so the nudge
  only has to also compare objectives whose window opens after the judged phase. **Ledger mode** has no
  counts for objectives the sector has not entered, so it needs an evaluation of HEAD, cached per commit
  like the base side. Without that, O1 works only in CI (G2), not in the local nudge an agent runs (G1).
  Experiment 2's agents run the local nudge, so base-only O1 helps arm B only through CI.
- **Accept when.** Probe P6 / fault F4 reports `ahead of plan` naming the objective, the phase it
  belongs to and the sector's phase; with `onAhead: ratchet` it exits non-zero, in every mode the
  chosen scope covers. Fault F1–F3, F7, F8 verdicts are unchanged.

### R1 — an open phase still reports what went back _(required)_

- **Problem.** At `settled`, restoring a deleted bookshelf model sends billing back to `data-moved`, and
  both nudge modes print `onTouch: ratchet (of settled) — ok`, `ask: note`, exit 0 (fault F3). The last
  phase is unprotected locally. Only `check` and the oxlint campaign rule fail.
- **Cause.** `settled` is an open phase (an intent, no objectives). `host/nudge.ts:495` sets
  `ask = "note"` for a judged-open phase and never assigns a verdict, although `back` was computed
  (`+no-hapi-models`) a few lines above.
- **Change.** Keep `ask: note`, but apply the onTouch verdict (`back` under ratchet) to whatever went
  back, as for any other phase.
- **Reproduce.** `campaign/billing-data-moved`; restore `subscription-model.ts` from
  `campaign/billing-routes-moved` and its entry in `src/application/models.ts`; run both nudge modes.
- **Accept when.** Fault F3: G1 and G2 report `back` and exit non-zero, and `ask` still reads `note`.

### R3 — behind the window is not past it _(required)_

- **Problem.** Fault F7 (one new cross-module import, at `served`) drops billing to `fenced`, which is
  correct. But `lint:architecture` then lists **7** served-phase entries as `no longer fire, or fire past
their window … clear them`. Following that advice closes the entries, and their initial, cleared and
  conceded counts start over when the sector returns: one regression erases the record of the work still
  owed.
- **Cause.** `domain/report.ts` ~238 and the `!inWindow` branch of `host/clear.ts` treat "not in window"
  as "past the window", even when the sector is _behind_ it.
- **Change.** Split the two cases. Entries whose window opens after the sector's current phase are
  held: neither stale nor new, never closed by `clear`, and reported as such if at all.
- **Accept when.** Fault F7: `check` reports the two new `no-cross-module-reach` hits and no stale
  entries. A `clear` run on that tree leaves the 7 served-phase entries unchanged.

### R2 — concessions are visible where they are made _(owner to confirm scope)_

- **Problem.** Fault F11 (F1b's unmirrored write, then `clear` and `concede`): the concession is what
  moves billing back from `backfilled` to `mirrored` in ledger mode, since the ledger-mode phase is derived
  from the ledgers. The local nudge then judges billing at `mirrored` (`onTouch: advise — ok`) and never
  mentions the concession. Only the CI nudge prints `conceded on this branch`. (`clear` printed `went back`
  but recorded nothing: `reachedRecord` only advances.)
- **Change.** (a) Ledger mode lists the concessions made in the working tree, by diffing the ledgers
  against HEAD, as base mode does against its base. (b) `concede` says when it sends a sector back a
  phase: `this concession moves billing back backfilled → mirrored`.
- **Open question for the owner.** Should a concession that moves a sector back across an _attested_
  phase be refused, or require re-attesting? Conceding an unmirrored write at `backfilled` effectively
  says the backfill no longer holds.
- **Accept when.** Fault F11: G1 prints the concession and the phase it moved the sector from, and the
  `concede` step's own output names the move.

### Not engine work: F5 and F6

Both faults can be expressed with today's campaign terms, so they become objectives in
`hapi-nest-strangler` (README, step 3b), not engine features. F5 is a sector-level `fn` or match objective:
the operations of a shared-state group are all local or all proxied. F6 is an ast-grep `syntax` rule with
`precedes`/`follows`: the mirror emit follows the write. If writing them exposes a missing term, report
that back as a separate item.

### T1 — a term that sees more than one file of a sector _(found in step 3b; not needed for gate 3b)_

Step 3b wrote F5 as a per-file `fn` (`shared-state-split`), which works because billing's and
organization's write groups each sit in one route file. A group that spans files cannot be
expressed: an `fn` sees one file, and a `sector` objective's only quantifier is `has`, one detector
that some file satisfies. "Some file has a local member of group G **and** some file has a
proxied one" needs two `has` terms joined by `all` at the sector level (or an `fn` handed the
sector's files). Today an `fn` that read the other file from disk would also be wrong in base
mode, which evaluates the base tree from git. Where it bites here: organization's reads-first
ordering spans `organization-routes.ts` and `organization-cli-routes.ts`, so the campaign does not
check it (`03-ab-plan-vs-campaign.md`, Appendix A). Acceptance: a sector objective whose holdout is
`all: [{ has: A }, { has: B }]`, with probes over a set of files.

## Tests to add in goodbones

For each fix, a test in the engine's own suite that reproduces the billing situation in a
fixture: a sector whose diff only deletes (C1); attest then clear (C2); a 600-character note
and a 21st note (C3); the per-sector status on a fixture with two sectors at different phases, plus
`--json` and a non-path positional (C4); a rename of an enclosing binding, in ledger and base mode (C6);
a paydown of a later phase's objective (O1); a regression at an open phase (R1); a sector sent behind
the window of entries it carries, then `clear` (R3); a concession in the working tree, and one that
moves a sector back a phase (R2). Probes in the manifest
(the engine already refuses a detector that fails its probe) are unaffected by these changes.

## Release, and bumping the pins in hapi-nest-strangler

1. Publish new betas: core, typescript, cli and oxlint at one exact version; campaigns at its
   own. Note the versions.
2. In `hapi-nest-strangler`, on a branch from `main` (after the billing stack has merged, or on
   top of it if it has not): set the five pins in the root `package.json`, `pnpm install`.
3. Run `pnpm lint`, `pnpm lint:rules`, `pnpm lint:edges`, `pnpm lint:architecture`, `pnpm
campaigns`, `pnpm test`. Expected ledger changes: none. C6 pairs entries without re-keying them, and C2
   changes how the phase is read, not what is stored. Any ledger change is a regression to report back,
   not to concede.
4. If O1 shipped: decide `onAhead` for `strangle-hapi` (recommendation: `ratchet`, since the
   phases encode a data-safety order) as a plan change in its own commit, receipted on the
   campaign as any plan change is.
5. Commit `chore: goodbones <version>, campaigns <version>`; open a PR. Then run experiment 1
   again (`01-seeded-faults.md`) on the new pins — that is gate 3.
