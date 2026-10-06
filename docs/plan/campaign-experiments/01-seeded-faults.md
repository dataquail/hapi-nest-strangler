# Experiment 1 — seeded faults

Part of the programme in `README.md` (steps 1 and 3). Self-contained: a session that has only this
file and the repository can run it.

## Purpose

Measure what the campaign can and cannot see, deterministically, without waiting for an agent to
make a mistake. Each fault is a fixed edit planted on one branch of the billing stack; the
harness records what the campaign says about it and — as the control — what every other gate in
the repository says. The result is a capability table with its gaps stated, plus a set of
_visibility probes_ that become the regression suite for the engine fixes.

It does **not** measure whether an agent would make these mistakes, or whether a plan document
would stop it. That is experiment 2. Here, "a plan document catches it" is impossible by
construction: a document checks nothing. The fair control is therefore _the other gates_: a
fault the tests already catch is no evidence for the campaign.

## Setup

- The billing stack (GitHub stack #35) fetched locally: `gh stack checkout 35` or the branches
  `campaign/billing-plan` … `campaign/billing-settled`.
- A Postgres reachable as `DATABASE_URL_TEST` whose database name contains `test`
  (`postgresql://postgres:postgres@localhost:5432/hapi-strangler-test` was used for billing).
- **One** scratch worktree reused for every fault (`git worktree add --detach <scratch>/wt-faults
campaign/billing-plan`), never the stack's own checkouts. Between faults: `git checkout
--detach <branch> && git reset --hard && git clean -fd`. Run `pnpm install --frozen-lockfile`
  only when the lockfile differs from the previous fault's branch (it changes at
  `billing-serve-writes-nest` and `billing-serve-writes-proxy`).
- Record the engine pins (`node_modules/@goodbones/*/package.json` versions) at the top of every
  results file.

## Where each branch leaves the billing sector

The phase a fault is planted in decides which objectives are in window, so every fault names its
branch. After each branch's commit, billing is at:

| Branch (`campaign/…`)        | Billing at            | Notable state                                     |
| ---------------------------- | --------------------- | ------------------------------------------------- |
| `billing-plan`               | fenced                | one cross-module holdout                          |
| `billing-fenced`             | rebuilt               | —                                                 |
| `billing-rebuilt`            | mirrored              | 4 unmirrored writes                               |
| `billing-mirror-start`       | mirrored              | 3 unmirrored writes; mirror plugin present        |
| `billing-mirror-cancel`      | mirrored              | 2 unmirrored writes (the webhook ingest)          |
| `billing-mirror-webhook`     | backfilled (attested) | every write mirrored                              |
| `billing-backfill`           | backfilled            | backfill script present, not attested             |
| `billing-attest`             | served                | 4 local routes, 4 legacy writes, no Nest endpoint |
| `billing-serve-read`         | served                | GET proxied; Nest read side live                  |
| `billing-serve-writes-nest`  | served                | Nest write side built, unrouted                   |
| `billing-serve-writes-proxy` | routes-moved          | every route proxied; legacy service gone          |
| `billing-retire-internal`    | routes-moved          | internal API gone                                 |
| `billing-routes-moved`       | data-moved            | hapi route file gone                              |
| `billing-data-moved`         | settled               | tables dropped, models gone                       |
| `billing-settled`            | settled               | notes recorded                                    |

## The gates recorded for every fault

Run in this order in the worktree, after applying the fault and `git add -A`. Record exit code
and the lines that name the fault (file, objective, or test name). A gate _catches_ a fault only
if it exits non-zero **and** its output points at the fault; exiting non-zero for an unrelated
reason (a flaky timeout) is re-run, not counted.

| ID  | Gate                                        | Command                                                                                                                             |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Nudge, ledger mode (local, stop-hook style) | `pnpm -s campaigns:nudge`                                                                                                           |
| G2  | Nudge, base mode (what CI runs)             | commit the fault on the detached HEAD, then `pnpm -s exec architecture campaigns status --changed --base <fault's branch> packages` |
| G3  | Campaign `check`                            | `pnpm -s lint:architecture`                                                                                                         |
| G4  | Lint                                        | `pnpm -s lint`                                                                                                                      |
| G5  | Type-check                                  | `pnpm -s check`                                                                                                                     |
| G6  | Unit tests                                  | `pnpm -s test`                                                                                                                      |
| G7  | Integration tests                           | `TEST_INTEGRATION=true` vitest for `@org/legacy-api`, `@org/server`, `@org/database` with `DATABASE_URL_TEST`                       |

Additionally record for G1/G2 whether the output _advises_ (names the fault, exit 0). Under a
phase with `onTouch: advise` that is the designed behaviour, and it is a different thing from
silence.

## The faults

Each is a mistake a strangling actually makes, in the place it would be made. "Predicted" is the
author's expectation before any run (2026-10-05) and is **not** a result; the point of the run is
to confirm or refute it. "Risk" is what the mistake does if it ships.

### F1 — a new legacy write, unmirrored, during `mirrored`

- **Branch:** `billing-mirror-cancel`. **Edit:** add a method `touchSubscription(organization)` to
  `billing-service.ts` that runs `this.knex("subscriptions").where({ organization_id: … })
.update({ updated_at: new Date() })` and emits nothing.
- **Risk:** the replica silently diverges; the backfill would square it once, but any write after
  the backfill is lost at cutover.
- **Predicted:** G1/G2 advise (`mirrored` is `onTouch: advise`), exit 0; G3 fails (a holdout the
  ledger does not carry); G4–G7 pass. _Caught by `check` only._

### F1b — the same write added after every write was mirrored, before cutover

- **Branch:** `billing-backfill` (sector at `backfilled`). **Edit:** as F1.
- **Risk:** the worst moment for it: the backfill has run or is about to, so this write's rows
  never reach the replica.
- **Predicted:** billing derives _back_ to `mirrored`; G1/G2 report `back` and exit non-zero
  (`backfilled` carries the campaign's `ratchet`); G3 fails; G4–G7 pass.

### F2 — a teammate adds a new billing route to hapi after the sector is served

- **Branch:** `billing-serve-read`. **Edit:** add `GET /orgs/{orgId}/billing/invoices` to
  `BillingContract.PrivateGroup` (so `test/route-parity.test.ts` stays green) and a local hapi
  handler for it in `billing-routes.ts`.
- **Risk:** new behaviour lands on the server being emptied; it has to be moved again, or is
  dropped at `routes-moved`.
- **Predicted:** `routes-still-local` +1; G1/G2 `back`, non-zero; G3 fails; G4–G7 pass.

### F3 — the sector is reported finished with a model left behind

- **Branch:** `billing-data-moved`. **Edit:** restore `subscription-model.ts` and its entry in
  `src/application/models.ts` (as if the deletion had been forgotten).
- **Risk:** dead code that still names a dropped table; the next sector inherits it.
- **Predicted:** `no-hapi-models` +1, billing derives back from `settled`; G1/G2 `back`; G3 fails;
  G4–G7 pass.

### F4 — work done ahead of its phase: reads served before the backfill is attested

- **Branch:** `billing-backfill`. **Edit:** apply the code of the `billing-serve-read` layer
  (commit `0fa988d`) _without_ the attestation layer before it: `git cherry-pick --no-commit
0fa988d`, then `git checkout HEAD -- .architecture-campaigns` so the ledgers are the branch's.
- **Risk:** reads come from a replica that was never backfilled: organisations that subscribed
  before mirroring began appear to have no subscription.
- **Predicted:** _missed by every gate._ `routes-still-local` and `has-nest-endpoints` are not
  in window at `backfilled`, so paying them down early is neither counted nor flagged; the
  layer's own tests come with it and pass. This is the ordering gap (O1 in `02-engine-fixes.md`).

### F5 — operations that share state flipped separately

- **Branch:** `billing-serve-writes-nest`. **Edit:** the `billing-serve-writes-proxy` layer
  reduced to the _start_ route alone: `POST /orgs/{orgId}/billing/subscriptions` becomes
  `proxyToNest()` (forwarding `stripe-signature` is not needed for it); `startSubscription` and
  its emit leave the service; the route test's start cases are updated to assert the forward.
  Cancel and the webhook stay local.
- **Risk:** a subscription started on the Nest server cannot be cancelled (hapi's cancel finds no
  legacy row → 404), and its Stripe webhooks are dropped by hapi.
- **Predicted:** _missed by every gate._ G1/G2 report `forward` (one route, one write paid down);
  every test passes. The campaign has no notion of holdouts that must clear together.

### F6 — the mirror is emitted before the write it announces

- **Branch:** `billing-mirror-start`. **Edit:** move the `SUBSCRIPTION_STARTED` emit in
  `startSubscription` above the `insert`.
- **Risk:** a failed insert still reaches the replica; the replica holds a subscription hapi
  does not.
- **Predicted:** _missed by every gate._ The detector only asks that a method containing a write
  also names `mirrorEvents`; the spec asserts the emitted payload, not its order.

### F7 — a sector re-couples to a sibling module

- **Branch:** `billing-serve-read`. **Edit:** in `billing-service.ts`, add
  `"organization/organization-service"` to `@require`, take it as a constructor argument and call
  one method on it in `cancelSubscription` (so lint sees it used).
- **Risk:** the sector can no longer leave without its neighbour.
- **Predicted:** `no-cross-module-reach` +1 and billing derives back to `fenced` — every later
  phase reads as lost; G1/G2 `back`; G3 fails; G4–G7 pass. (Record how alarming the output reads:
  a one-line coupling drops the sector five phases.)

### F8 — a legacy write reintroduced after the Nest server became the source of truth

- **Branch:** `billing-retire-internal`. **Edit:** add `billing-service.ts` back with one method
  that inserts into `subscriptions` (an "admin repair tool"), registered with the container.
- **Risk:** two sources of truth again.
- **Predicted:** `legacy-writes` +1, billing derives back to `served`; G1/G2 `back`; G3 fails.

### F9 — control: an architecture violation on the Nest side

- **Branch:** `billing-serve-writes-nest`. **Edit:** make
  `commands/start-subscription.handler.ts` import `BillingGatewayLive` from
  `../infrastructure/clients/billing-gateway.client-live.js`.
- **Purpose:** show the campaign does not duplicate the architecture lint.
- **Predicted:** G4 fails (`architecture/imports`); G3 fails on the same rule; the campaign parts
  of G1–G3 are silent.

### F10 — control: a semantic mistake no gate is designed to see

- **Branch:** `billing-serve-writes-nest`, the one branch where the internal record API and the
  billing gateway port both exist. **Edit:** make `RecordSubscriptionHandler` inject
  `BillingGateway` and call its `createCustomer` and `createSubscription` before inserting (the
  mirror now opens a second subscription with the provider); update the handler test's
  constructor call to pass a `BillingGatewayFake`.
- **Purpose:** calibration — what review alone must catch.
- **Predicted:** missed by every gate.

### F11 — a new holdout conceded instead of fixed

- **Branch:** as F1b, then run `pnpm campaigns:clear` and
  `pnpm exec architecture objectives concede strangle-hapi/writes-not-mirrored --reason "temporary"`.
- **Purpose:** what the ratchet looks like when an agent routes around it.
- **Predicted:** every gate green; the concession is a visible ledger change with its reason.
  Record whether anything in G1/G2 output draws attention to a _new_ concession (it should: a
  reviewer's only signal).

## Visibility probes (for the engine fixes)

Not mistakes: situations where the baseline output is wrong or unhelpful, each tied to a fix in
`02-engine-fixes.md`. Record the exact output; after step 2 the same probe should show the fix.

| ID  | Fix | Branch                    | Do                                                                                             | Baseline output (observed 2026-10-05)                                              |
| --- | --- | ------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P1  | C1  | `billing-retire-internal` | `git cherry-pick --no-commit 3ed1804`, restore `.architecture-campaigns`; run G1 and G2        | no billing block at all; only `legacy … diff neutral`                              |
| P2  | C2  | `billing-backfill`        | `campaigns attest billing backfilled --reason x`, then `pnpm campaigns:clear`                  | `billing went back settled → served`                                               |
| P3  | C3  | any                       | `campaigns note billing "<600 characters>"`; read `sectors/billing.json`                       | `note left on billing`; text silently cut to 500                                   |
| P4  | C4  | `billing-serve-read`      | ask for billing's phase and in-window holdouts without `explain` or reading JSON               | no command does it; `status --json` refuses without `--changed`                    |
| P5  | C6  | `billing-attest`          | rename the `applied` const in `ingestStripeWebhook` to `outcome` (no behaviour change); run G1 | predicted: `legacy-writes` −2 +2 under a ratchet — two "new" holdouts for a rename |
| P6  | O1  | as F4                     | as F4                                                                                          | predicted: silent                                                                  |

## The harness

Write it as a script under `docs/plan/campaign-experiments/harness/` (not under `scripts/`:
the architecture manifest walks `scripts/`, and an experiment should not move the coverage
floors). One entry per fault and probe: `{ id, branch, apply(worktree), gates }`, where `apply`
performs the edit with exact string replacements that throw if their anchor is missing (so a
fault that silently fails to apply is an error, not a pass). For each entry: reset the
worktree to the branch, apply, stage, run the gates, capture stdout, stderr and exit code, then
reset. Write `results/seeded-faults-<campaigns-version>.json` (raw) and a Markdown table.

Budget: the type-check and the integration suites dominate; expect roughly 3–5 minutes per
fault, under an hour for the whole set. G5–G7 may be skipped for a fault whose prediction does not
involve them only on the _rerun_, never on the baseline.

## Results table (fill in)

```
Engine: core …, campaigns …            Date: …

| Fault | G1 nudge | G2 CI nudge | G3 check | G4 lint | G5 tsc | G6 unit | G7 integ. | Campaign only? | Prediction held? |
| F1    |          |             |          |         |        |         |           |                |                  |
…
| Probe | Output (verbatim, trimmed) | Matches baseline / fixed? |
| P1    |                             |                            |
…
```

## How to read it

- **Campaign only** — the campaign caught it and no other gate did. This is the experiment's
  headline number: it is the part of the campaign's value a test suite cannot replace.
- **Also caught elsewhere** — the campaign adds nothing for this fault.
- **Missed by every gate** — state it plainly in the write-up. F4–F6 are predicted here; they are
  the ordering and semantics a plan document tells an agent about and a detector does not check.
  If F4/F5 are confirmed, gate 1 adds O1 to the fix list.
- **Advised, not failed** — the nudge named it but did not gate (F1 under `advise`). Count it
  separately: it is useful to an agent that reads the output, useless to CI.
- The predictions are the author's; a refuted prediction is a finding in its own right and goes in
  the findings log.
