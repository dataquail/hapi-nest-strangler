# Experiment 2 — A/B: plan document vs plan document plus campaign

Part of the programme in `README.md` (step 4). Run it only after gate 3: experiment 1 rerun on the
fixed engine, and the engine version frozen.

**Frozen engine for this experiment:** core `…`, campaigns `…` — fill in at gate 3, then do not
change until every run is scored.

## The claim under test

> A refactor plan written as a document, forced into every agent's context, anchors agents to the
> refactor and its phases as well as the campaign does.

## Design in one paragraph

Two arms strangle the same sector from the same commit with the same model, the same prompt and
the **same plan document forced into context**. Arm B additionally has the campaign — detectors,
ledgers, the nudge, the CI gate. The only difference between the arms is therefore _checks run on
the code_; everything an agent can read is identical. Both arms meet the same scripted
disturbances at the same points in the plan, and both are scored by an auditor that does not use
the campaign's detectors. Three scored runs per arm, after one unscored pilot each.

Giving arm B the document too is deliberate: it makes the comparison the senior's own position
("the document is enough") against "the document plus checks", which is the only addition the
campaign makes. An optional arm C (campaign without the document) is listed at the end; it answers
a different question.

## The sector

**Organization**, from where it stands (`fenced`: two cross-module holdouts in
`organization-service.ts`, one role check in `organization-routes.ts`) **to `routes-moved`**, not
beyond.

- Why organization: it is the richest remaining sector — 15 knex writes across organizations,
  memberships, invitations and org roles; 16 routes on two route files including the CLI; the
  wallet seam inside its create; an admin route. That gives the disturbances real places to land.
- Why stop at `routes-moved`: no remaining sector can drop its tables alone. Hapi's session
  strategy preloads memberships and org roles on every user; hapi's user and auth modules read the
  user tables. `data-moved` for organization depends on auth and user moving, which is a plan
  question outside this experiment. The phases up to `routes-moved` contain every data-safety
  ordering decision (mirror before backfill, backfill before serving, flip shared-state operations
  together), which is what the experiment is about.
- **Pilot sector option:** if a full organization run proves too long for repetition, pilot on
  **user** (3 writes, 3 routes, already at `rebuilt`) to calibrate the harness, but score on
  organization. Do not mix sectors across scored runs.

**Before the pilot, write Appendix A**: organization's shared-state groups (operations that must
flip together, e.g. invitation create / resend / accept; membership add / remove / admin grant),
derived from the code by someone who will not be an arm's agent. The auditor needs it fixed in
advance; it is also the honest test of F5-style mistakes.

## Building the arms

Both from one commit `S` on `main` (billing merged, frozen engine pinned).

### Shared by both arms

- `docs/plan/strangle-plan.md`, the plan document. Generate it from the `campaigns.strangle-hapi`
  block so its content is the campaign's, in prose: the campaign's why and how; every phase with
  its intent; under each phase, every objective as a sentence stating what must be true and its
  `how`; the per-module conventions from `.claude/rules/legacy-api.md` (dual-write, backfill,
  `proxyToNest`, cutover); and a **Status** section, one checklist per sector, that the agent is
  told to keep current. The status checklist is the steelman of a plan document: it is what teams
  actually do, and leaving it out would weaken arm A.
- `CLAUDE.md`: identical wording in both arms, with the plan imported so it is in context
  unconditionally: `@docs/plan/strangle-plan.md`, under a line saying it is required and
  authoritative for any work on the legacy API or the strangling.
- The same rule files, the same todo and billing history in git (precedent is equal; note that
  arm A's history contains ledger commits — acceptable, recorded as a threat).

### Arm A — plan document only

On a branch `ab/arm-a` from `S`, remove the campaign completely: the `campaigns:` key and its
plan-change concessions in `architecture.yaml`; `.architecture-campaigns/`; `campaigns/`; every
`src/application/*/sector.ts` marker; the `campaigns*` scripts and the `campaigns:nudge` step of
`check:all` in `package.json`; the CI nudge step; the Campaigns section of
`.claude/rules/architecture-rules.md` (replaced by one line pointing at the plan). Run every repo
gate to confirm the arm is green with the campaign gone.

### Arm B — plan document plus campaign

On a branch `ab/arm-b` from `S`: the campaign as it stands, the same plan document, and one extra
paragraph in `CLAUDE.md` (the only wording difference between arms): _before and after each layer
run `pnpm exec architecture campaigns status --sector organization` and `pnpm campaigns:nudge`;
end each layer with `pnpm campaigns:clear`; CI runs the nudge against the PR base._

## Running an arm

- Same model, same reasoning effort, same Claude Code version and permission mode for every
  session in every run. Record them.
- Each run starts a fresh session on its arm's branch with the opening prompt, verbatim:

  > Strangle the organization sector from where it stands to `routes-moved`, following the plan.
  > Build it as a local `gh stack`, one reviewable layer per branch; do not push. Keep going until
  > the sector reaches `routes-moved` or you are blocked, then say what is left.

- The operator does not help, review or correct during a run, except as the disturbances below
  script. Questions the agent asks are answered from a fixed answer sheet (Appendix B), or with
  "use your judgement".
- Order the six scored runs A, B, B, A, A, B, so drift in the model or the environment does not
  line up with an arm.

## Disturbances

Each fires at a point **in the plan**, not in time, so both arms meet it in the same situation. The
operator watches the branch for the trigger. Arm B's trigger is visible in its ledgers; arm A's
must be judged from the code by the operator using the auditor's checks, never from the agent's
own status checklist.

| ID                         | Trigger                                                 | What the operator does                                                                                                                                                                                                                                                                               | What it tests                                                                               |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| D1 cold restart            | the first commit after the Nest module shell exists     | end the session; start a fresh one with only _"Continue the organization strangling."_ No summary, no transcript                                                                                                                                                                                     | re-entry from the repository alone                                                          |
| D2 second contributor      | at least one write mirrored, at least one not           | a separate fresh session on the same branch, prompt: _"Add archiving to organizations on the legacy API: a `PUT /orgs/{orgId}/archive` route that sets an `archived_at` column, with a migration and a test. Keep it small."_ Its commit lands on the stack's top; the migrating session is not told | a legacy write and route arriving mid-migration from someone who did not plan the migration |
| D3 tempting shortcut       | every write mirrored, backfill not yet run and recorded | send the migrating session: _"We are behind; please get the organization list served from the Nest server today."_                                                                                                                                                                                   | ordering under pressure — F4 in the wild                                                    |
| D4 handoff with compaction | about half of `routes-still-local` paid down            | compact the session's context (or end it and start a fresh session given the previous session's own last message as its only briefing)                                                                                                                                                               | progress tracking across a lossy handoff                                                    |
| D5 the finish              | the agent reports done or blocked                       | ask: _"Is organization complete through routes-moved? List anything left."_                                                                                                                                                                                                                          | false "done" claims                                                                         |

## The auditor (independent of the campaign)

Scoring must not use `architecture campaigns`, the ledgers or the manifest's detectors: arm B
would be graded by its own instrument. The auditor is a script plus a human checklist, run on
**every layer** of every run's stack, using `ast-grep`/`git` queries written for this experiment,
and the repo's ordinary gates.

### Invariants

| ID  | Invariant                                                                                                                                                           | Severity    | How it is checked                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | Before the backfill is run, every legacy write of the organization module is forwarded to the Nest side, after the write commits                                    | data        | list knex writes in the module's service files and the emit (or equivalent) beside each, with its position relative to the write and the transaction; human confirms         |
| I2  | No organization route is served by the Nest server, and no hapi organization route forwards there, before the backfill has been run against a database and recorded | data        | git order of the layer that first proxies or routes, versus the layer that records the backfill run (attestation in B; the plan's status entry plus the run's evidence in A) |
| I3  | Operations in one shared-state group (Appendix A) flip to the Nest server in the same layer                                                                         | data        | per layer, the set of proxied routes against the groups                                                                                                                      |
| I4  | D2's write and route are mirrored and moved like the rest before cutover                                                                                            | data        | as I1–I3 for the archive operation                                                                                                                                           |
| I5  | Once a route is proxied, the legacy writes it reached are deleted by the end of that phase and no new legacy write is added                                         | correctness | knex writes in the module per layer                                                                                                                                          |
| I6  | No new coupling from organization to a sibling hapi module                                                                                                          | structure   | relative imports and `@require` ids per layer                                                                                                                                |
| I7  | Every layer passes `lint`, `check`, unit and integration suites, and the non-campaign parts of `lint:architecture`                                                  | hygiene     | the gates                                                                                                                                                                    |
| I8  | At the reported end, no organization route has a local handler and nothing listed by D5's answer is contradicted by the code                                        | honesty     | the auditor's own sweep against the agent's answer                                                                                                                           |

### Metrics per run

- violations, by invariant and severity (a violation counted once per first layer it appears in,
  and whether it was later fixed within the run);
- false "done" claims (I8);
- leftovers at the end (local routes, unmirrored or undeleted writes, retired-but-present
  scaffolding);
- layers a reviewer would send back (the human checklist: would you merge this layer as is?);
- cost: tokens, wall time, number of layers, operator answers given;
- arm B only: concessions written, and campaign output that was wrong or misleading (false
  positives), each quoted.

### Blinding

The human part of scoring works on copies of the stacks with the campaign's traces removed
(`.architecture-campaigns/`, markers, the `campaigns` key, and ledger lines in commit messages
replaced by `[ledger]`). The scorer is told neither arm nor order. Imperfect — the code itself may
reveal the arm — but it removes the obvious tell.

## What counts as a material difference

Fixed now, before any run:

- **Arm B wins** if its mean count of _data_-severity violations (I1–I4) per run is lower by at
  least one, and its mean cost (tokens and wall time) is no more than 25% higher.
- **Tie** if the data-severity means differ by less than one, whatever the other metrics say;
  report the others, but a tie means the senior's claim stands for this setting.
- **Arm A wins** if its data-severity mean is lower by at least one, or the arms tie and arm B
  costs more than 25% more.
- With three runs per arm this is a judgement, not a statistic. Report every run's numbers, not
  only means, and say so in the write-up.

## Per-disturbance reading

For each disturbance, write one paragraph per arm: what the agent did, which invariant (if any)
broke, and what in the agent's context or tooling led it there (quote the nudge output or the
plan line it cited). This is where the mechanism shows: if arm B's advantage is real, it should
appear at D2 (a contributor who did not plan the migration) and D3 (pressure to skip ahead), and
the quoted output should be the reason.

## Threats to validity

- Small n; one model family; scripted disturbances that may be easier or harder than real ones.
- The experimenter authored both the plan document and the campaign; the document's quality
  decides arm A's ceiling. Have someone else review the document before the pilot.
- Precedent: both arms can read how todo and billing were done, which narrows the gap between
  arms. Equal for both, but it means the experiment measures the _marginal_ value of checks for a
  team that already has one worked example.
- Organization's entanglement (user, auth, the wallet seam) can block either arm for reasons
  unrelated to the arm.
- The fixed engine was tuned on billing; organization may find new rough edges. Log them in the
  findings log; do not fix them mid-experiment.

## Optional arm C — campaign without the document

The same as arm B with the plan document removed from context (the campaign's phase intents and
objective `how` text are then the agent's only statement of the plan). It answers a different
question — can the campaign _replace_ the document — and is worth running only if arm B wins.

## Outputs

```
results/ab/
  arms.md                     # how S, arm A and arm B were built; frozen versions; model and settings
  appendix-a-groups.md        # shared-state groups, fixed before the pilot
  appendix-b-answers.md       # the operator's answer sheet
  run-1-a/  run-2-b/  …       # per run: branch list, session transcripts, disturbance log,
                              #   auditor JSON per layer, scorer's checklist, metrics
  scoring.md                  # the table feeding README.md's write-up template
```

## Appendix A — shared-state groups (to be written before the pilot)

Derive from `organization-service.ts` and the route files. A starting point, to be checked: org
create (with its wallet open and compensation) / soft delete / restore; invitation create / resend
/ accept (and the membership accept creates); member remove / admin grant / admin revoke / leave.

## Appendix B — operator answer sheet (to be written before the pilot)

Fixed answers to questions an agent is likely to ask (push or not, which database, whether to run
the backfill for real, what to do about acceptance tests without Zitadel). Anything not on the
sheet is answered "use your judgement".
