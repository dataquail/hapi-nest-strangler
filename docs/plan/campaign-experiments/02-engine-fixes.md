# Step 2 — Engine fixes before the A/B

Part of the programme in `README.md`. This is a brief for a session working in the **goodbones**
repository (`dataquail/goodbones`), to be issued after experiment 1's baseline (gate 1) and
before its rerun. It is self-contained; the evidence behind each item is in
`docs/plan/campaign-rough-edges-billing.md` of `dataquail/hapi-nest-strangler` (entries
B1–B21), and every reproduction below names a branch of that repo's billing stack (GitHub stack
#35).

## Why these, and only these

Experiment 2 puts a campaign-guided agent through cold restarts, handoffs and a second
contributor. The fixes below are the ones that distort what that agent sees at exactly those
moments; leaving them in would bias the A/B against the campaign for reasons unrelated to the
idea. Everything else in the findings log (C5, C7–C10, the documentation items) is deliberately
deferred: none changes what an agent does mid-sector.

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
- **Cause.** `host/clear.ts` ~316 (`sectorMovesOf`) takes `from` from `ledgerPhaseOf`, which
  reads the phase off the ledgers alone; objectives the sector has never entered have no entries,
  so every phase after the attested one reads as met.
- **Change.** Take `from` from the sector record's `reached`; or make `ledgerPhaseOf` stop at the
  first phase containing an objective the sector has not entered.
- **Reproduce / accept.** Probe P2: on `campaign/billing-backfill`, attest, clear → `billing moved
backfilled → served`.

### C3 — a note is never cut silently _(required)_

- **Problem.** `campaigns note` stores the first 500 characters and reports success. Both settled
  notes in the repo (todo's, billing's first) were cut mid-sentence (B18).
- **Cause.** `core/ledger.ts:843` `NOTE_LENGTH = 500`, applied by `text.slice(0, NOTE_LENGTH)`.
- **Change.** Refuse an over-long note with the limit and the length in the message (preferred:
  the author splits it deliberately), or keep notes whole. Either way, never truncate quietly.
- **Accept when.** Probe P3: a 600-character note is refused with a message naming 500 and 600,
  or stored whole; nothing is stored cut.

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
- **Accept when.** Probe P4: on `campaign/billing-serve-read`, `campaigns status --sector billing`
  shows `served`, `routes-still-local 3` with the three route locations, `legacy-writes 4` with
  theirs, and the measure.

### C6 — holdout keys by enclosing function _(if cheap)_

- **Problem.** A holdout's key is the nearest enclosing _binding_: a refactor that wrapped a
  transaction's result in `const applied = …` re-keyed two `legacy-writes` holdouts from
  `#ingestStripeWebhook` to `#applied`. In window under a ratchet, a pure rename reads as two
  cleared and two new (B16).
- **Change.** Key by the enclosing function or method declaration (or class member), skipping
  variable bindings; or let `clear` and the nudge pair a vanished holdout with a new one in the
  same file, same objective and same matched text before calling it new.
- **Caution.** A new key scheme re-keys every existing ledger entry. Ship it with a migration
  (re-key on the first `clear` without reporting churn) or this repo's `check` fails on upgrade
  with every holdout stale and new.
- **Accept when.** Probe P5 reports nothing new for the rename, and bumping the pin in
  `hapi-nest-strangler` passes `pnpm lint:architecture` after at most one `clear` that reports no
  cleared or new holdouts.

### O1 — work done ahead of its phase _(conditional on experiment 1)_

Build it **only if** experiment 1 confirms fault F4 is missed by every gate. That is the
prediction, and if it holds this is the most important item in the brief: ordering is the one
thing a plan document conveys that the campaign does not check, and an A/B without it compares a
campaign with a known hole to a document without one.

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
- **Accept when.** Probe P6 / fault F4 reports `ahead of plan` naming the objective, the phase it
  belongs to and the sector's phase; with `onAhead: ratchet` it exits non-zero. Fault F1–F3, F7, F8
  verdicts are unchanged.

### Not proposed: operations that must flip together (F5)

Fault F5 (start proxied while cancel and the webhook stay local) is predicted missed and will
stay missed. No objective-level setting fits: `routes-still-local` legitimately moved the GET
alone. A sector-level "these holdouts clear in one diff" declaration would need the plan author
to name the group per sector, which is knowledge the plan document already carries in prose.
Record F5 as a known limitation in the write-up rather than build it now.

## Tests to add in goodbones

For each fix, a test in the engine's own suite that reproduces the billing situation in a
fixture: a sector whose diff only deletes (C1); attest then clear (C2); a 600-character note
(C3); the per-sector status on a fixture with two sectors at different phases (C4); a rename of
an enclosing binding (C6); a paydown of a later phase's objective (O1). Probes in the manifest
(the engine already refuses a detector that fails its probe) are unaffected by these changes.

## Release, and bumping the pins in hapi-nest-strangler

1. Publish new betas: core, typescript, cli and oxlint at one exact version; campaigns at its
   own. Note the versions.
2. In `hapi-nest-strangler`, on a branch from `main` (after the billing stack has merged, or on
   top of it if it has not): set the five pins in the root `package.json`, `pnpm install`.
3. Run `pnpm lint`, `pnpm lint:rules`, `pnpm lint:edges`, `pnpm lint:architecture`, `pnpm
campaigns`, `pnpm test`. Expected ledger changes: none, or one re-key `clear` if C6 shipped
   with a migration. Any other ledger change is a regression to report back, not to concede.
4. If O1 shipped: decide `onAhead` for `strangle-hapi` (recommendation: `ratchet`, since the
   phases encode a data-safety order) as a plan change in its own commit, receipted on the
   campaign as any plan change is.
5. Commit `chore: goodbones <version>, campaigns <version>`; open a PR. Then run experiment 1
   again (`01-seeded-faults.md`) on the new pins — that is gate 3.
