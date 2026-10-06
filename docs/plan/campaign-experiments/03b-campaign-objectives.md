# Step 3b — Campaign objectives for F5 and F6

Part of the programme in `README.md` (step 3b). A brief for a session working in this repository, on a
new branch from `main`. Read `CLAUDE.md`, then `.claude/rules/architecture-rules.md` (Campaigns section)
and `.claude/rules/legacy-api.md` before touching anything.

## Background (read these first)

All in this folder:

- `README.md`: the programme. This task is **step 3b**; read its section and gate 3b.
- `01-seeded-faults.md`: faults **F5** and **F6**, which the campaign should catch once this is done.
- `results/seeded-faults-campaigns-0.1.1-beta.4.md`: the baseline. F5 and F6 were missed by every gate.
  See finding R4 and "Consequence for experiment 2".
- `03-ab-plan-vs-campaign.md`: the A/B that will use these objectives. Its Appendix A is part of this
  task.
- `harness/` (`run.mjs`, `entries.mjs`, `patches/F5.patch`): the experiment-1 harness that validates the
  objectives.

The campaign definition is the `campaigns.strangle-hapi` key in the root `architecture.yaml`, plus
`campaigns/strangle-hapi.mjs`. Engine docs:
<https://dataquail.github.io/goodbones/campaigns/getting-started/introduction/>. The engine is installed
at `@goodbones/campaigns@0.1.1-beta.4`; its source is under
`node_modules/.pnpm/@goodbones+campaigns@0.1.1-beta.4/node_modules/@goodbones/campaigns/src`. **Do not
edit the engine.** If an objective cannot be expressed with today's terms, stop and report the missing
term instead of working around it.

## What to build

### 1. F5: operations that share state flip together

The operations of a shared-state group must be all local or all proxied (`proxyToNest`), never split. In
F5, billing's `POST /orgs/{orgId}/billing/subscriptions` was proxied while
`DELETE …/subscriptions/current` and `POST /webhooks/stripe` stayed local. A subscription started on Nest
then cannot be cancelled on hapi, and its webhooks are dropped.

- Groups are declared per sector. Declare billing's (start, cancel, webhook) so the harness can test the
  objective, and organization's from Appendix A.
- Decide where the declaration lives (for example a table in `campaigns/strangle-hapi.mjs`, or the
  sector markers), and say why.
- A `fn` term sees **one file at a time**. Billing's routes sit in one file; organization's span
  `organization-routes.ts` and `organization-cli-routes.ts`. Check whether a per-file term can express a
  group that spans files. If it cannot, say so: that is a finding for `02-engine-fixes.md`, not something
  to hack around.
- Choose the phase window deliberately. A split group must count as a new holdout while routes are being
  moved (`served`), so the ratchet sends the sector back.

### 2. F6: the mirror emit follows the write

An ast-grep `syntax` rule, using `precedes`/`follows` relational rules if ast-grep supports them here:
inside a service method, a `mirrorEvents.*` emit must come after the knex write it announces. In F6 the
`SUBSCRIPTION_STARTED` emit was moved above the `insert`, so a failed insert still reaches the replica.
Decide its window too (it matters from `mirrored` on, while legacy writes exist).

### Rules for both

- Write them **by shape, not by billing's names**. They must apply unchanged to organization, user and
  auth.
- Each objective gets a `how` that tells an agent what to do, and probes that fire on a planted violation
  and stay quiet on a correct example. The loader refuses an objective whose probe fails.
- Adding objectives to defined phases is a plan change: a `concessions` entry on each changed phase, in
  its own commit with its receipt. Seed the ledgers with `pnpm campaigns:clear`. The new objectives should
  find nothing on `main` (billing is settled; organization is not in their window yet). If they do find
  holdouts, stop and report them; do not concede them.
- `pnpm architecture:explain <file>` prints each term's hit count on a file; use it to tune.

### 3. Appendix A of `03-ab-plan-vs-campaign.md`

Organization's shared-state groups, derived from `packages/legacy-api/src/application/organization/`
(the service and both route files). The appendix has a starting point "to be checked"; check it against
the code and write the final list. It feeds both the F5 objective's organization groups and arm A's plan
document, so state each group with its routes and the reason they share state.

## Validate (gate 3b)

Rerun the experiment-1 harness and show that F5 and F6 are now caught while nothing else changes verdict.

- **The catch:** the harness checks out the billing stack's branches (`campaign/billing-*`), and those
  branches carry the _old_ campaign definition. Add an overlay step to `harness/run.mjs`, behind a flag
  such as `--campaign-from <ref>`:
  1. Copy the campaign definition from your branch onto each checked-out branch.
  2. Seed the new objectives' ledgers with `campaigns:clear`.
  3. Commit that as the fault's base, then apply the fault.

  G2 must use that commit as its `--base`. Without the overlay, the controls would turn red on the
  definition change itself.

- Run the whole entry set (all eight controls, F1–F11, P1–P5) under the overlay. Every control must stay
  green on G1–G7.
- The harness needs a scratch worktree (see the top of `run.mjs`) and
  `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/hapi-strangler-test`.
- Write the results to `results/seeded-faults-campaigns-0.1.1-beta.4-3b.md` (raw output under
  `results/raw/`, in a folder of its own so the baseline's is untouched). Use the baseline's table layout,
  plus a column comparing each row with the baseline; any change other than F5 and F6 becoming caught gets
  an explanation.

Also run the repo's gates on your branch: `pnpm lint`, `pnpm lint:rules`, `pnpm lint:edges`,
`pnpm lint:architecture`, `pnpm campaigns`, `pnpm test`.

## Deliverables

- The objectives, their probes and the phase concessions, in their own commit.
- Appendix A, the harness overlay and the results file, in separate commits.
- Open a **draft** PR and stop. Freezing the engine version and the campaign definition at gate 3b is the
  owner's call.
- In your final message: what each objective counts and in which window; anything the terms could not
  express; any verdict that changed besides F5 and F6.
