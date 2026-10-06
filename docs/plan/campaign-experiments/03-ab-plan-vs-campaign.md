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

| ID  | Invariant                                                                                                                                                                                   | Severity    | How it is checked                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | Before the backfill is run, every legacy write of the organization module is forwarded to the Nest side, after the write commits                                                            | data        | list knex writes in the module's service files and the emit (or equivalent) beside each, with its position relative to the write and the transaction; human confirms         |
| I2  | No organization route is served by the Nest server, and no hapi organization route forwards there, before the backfill has been run against a database and recorded                         | data        | git order of the layer that first proxies or routes, versus the layer that records the backfill run (attestation in B; the plan's status entry plus the run's evidence in A) |
| I3  | Operations in one shared-state group (Appendix A) flip to the Nest server in the same layer                                                                                                 | data        | per layer, the set of proxied routes against the groups                                                                                                                      |
| I4  | D2's write and route are mirrored and moved like the rest before cutover                                                                                                                    | data        | as I1–I3 for the archive operation                                                                                                                                           |
| I5  | Once a route is proxied, the legacy writes it reached are deleted by the end of that phase and no new legacy write is added                                                                 | correctness | knex writes in the module per layer                                                                                                                                          |
| I6  | No new coupling from organization to a sibling hapi module                                                                                                                                  | structure   | relative imports and `@require` ids per layer                                                                                                                                |
| I7  | Every layer passes `lint`, `check`, unit and integration suites, and the non-campaign parts of `lint:architecture`                                                                          | hygiene     | the gates                                                                                                                                                                    |
| I8  | At the reported end, no organization route has a local handler and nothing listed by D5's answer is contradicted by the code                                                                | honesty     | the auditor's own sweep against the agent's answer                                                                                                                           |
| I9  | Before any operation of `organization-writes` is proxied, every Nest-side change to organizations, memberships and organization roles is forwarded to hapi's legacy tables after it commits | data        | the layer that first proxies a group operation, against the layer that adds the reverse forward and its test; human confirms each written table is covered                   |
| I10 | No Nest module reads organization's legacy tables (`public.memberships`, `public.organization_roles`, `public.organizations`) once the group is proxied                                     | data        | `public.` reads in `packages/server/src` per layer, against the layer that proxies the group                                                                                 |

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

- **Arm B wins** if its mean count of _data_-severity violations (I1–I4, I9, I10) per run is lower by at
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

## Appendix A — shared-state groups

Derived 2026-10-06 from `main` (`00f59e7`): `organization-service.ts`, `organization-routes.ts` and
`organization-cli-routes.ts` in `packages/legacy-api/src/application/organization/`. Fixed for the
pilot and the scored runs. The campaign's `shared-state-split` objective reads the same list from
`SHARED_STATE_GROUPS` in `campaigns/strangle-hapi.mjs`; arm A's plan document states it in prose.

**What makes two operations share state.** In `served`, a route that is proxied writes the Nest
module's tables only, while a route hapi still serves writes the legacy table and mirrors it
forward. Nothing flows back. So two write operations must flip together when one writes rows the
other reads or writes. Reads are not group members: they flip first, once the backfill is
recorded, because the replica is then complete and every local write still reaches it (the
billing stack served its read in its own layer for this reason).

### What each write operation touches

| Route                                                  | Service method       | Writes                                                                                          | Reads before writing             |
| ------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------- |
| `POST /orgs`                                           | `createOrganization` | insert `organizations`, `memberships`, `organization_roles` (one transaction; opens the wallet) | —                                |
| `DELETE /orgs/{id}`                                    | `softDelete`         | update `organizations.deleted_at`                                                               | the organization row             |
| `POST /orgs/{id}/restore`                              | `restore`            | update `organizations.deleted_at`                                                               | the organization row             |
| `POST /orgs/{orgId}/invitations`                       | `inviteUser`         | insert `invitations`, or update the open one (reissue)                                          | open invitations for the address |
| `DELETE /orgs/{orgId}/invitations/{invitationId}`      | `revokeInvitation`   | update `invitations.revoked_at`                                                                 | the invitation                   |
| `POST /orgs/{orgId}/invitations/{invitationId}/resend` | `resendInvitation`   | update `invitations` (token, expiry)                                                            | the invitation                   |
| `POST /invitations/{token}/accept`                     | `acceptInvitation`   | update `invitations.accepted_at`, insert `memberships` (one transaction)                        | the invitation by token          |
| `DELETE /orgs/{orgId}/members/{userId}`                | `removeMember`       | delete `memberships`                                                                            | —                                |
| `POST /orgs/{orgId}/leave`                             | `leave`              | delete `memberships`                                                                            | —                                |
| `POST /orgs/{orgId}/members/{userId}/admin`            | `promoteMember`      | insert `organization_roles`                                                                     | the member's admin role          |
| `DELETE /orgs/{orgId}/members/{userId}/admin`          | `demoteMember`       | delete `organization_roles`                                                                     | —                                |

Every route above with an organization in its path, except `leave`, also checks that organization
against the legacy `organizations` table (`rowExists`), and all but `accept` authorize through
hapi's ACL, which reads the caller's `memberships` and `organization_roles` from the legacy tables.

### The groups

The starting point proposed three groups. The code does not allow them to flip separately:

- _Organization lifecycle_ (create / soft delete / restore) shares `organizations` rows. Create
  also inserts the creator's membership and admin role, so it shares rows with remove, leave and
  demote. If create were proxied and demote stayed local, demoting the creator would find no
  legacy role row (409); if demote were proxied and create stayed local, the creator would keep the
  admin role hapi's ACL reads.
- _Invitations_ (invite / revoke / resend / accept) share `invitations` rows. Accept also inserts a
  membership, so it shares rows with remove and leave.
- _Members and roles_ (remove / leave / promote / demote) share `memberships` and
  `organization_roles` rows with create and accept.

Create bridges the first and third group; accept bridges the second and third. Every write therefore
falls in one group:

| Group                 | Operations (all in `organization-routes.ts`)                                                                                                                                                                                                                                                                                                                                                                   | Why they share state                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `organization-writes` | `POST /orgs`, `DELETE /orgs/{id}`, `POST /orgs/{id}/restore`, `POST /orgs/{orgId}/invitations`, `DELETE /orgs/{orgId}/invitations/{invitationId}`, `POST /orgs/{orgId}/invitations/{invitationId}/resend`, `POST /invitations/{token}/accept`, `DELETE /orgs/{orgId}/members/{userId}`, `POST /orgs/{orgId}/leave`, `POST /orgs/{orgId}/members/{userId}/admin`, `DELETE /orgs/{orgId}/members/{userId}/admin` | one connected set over `organizations`, `memberships`, `organization_roles` and `invitations`; create and accept join the tables |

The reads, which flip before the group and may flip in any order among themselves: `GET /orgs`,
`GET /orgs/{orgId}/invitations`, `GET /orgs/{orgId}/members`, `GET /admin/orgs` and the CLI's
`GET /cli/orgs` (in `organization-cli-routes.ts`).

### Constraints the groups do not capture

- **Readers outside the sector: decided 2026-10-06, a reverse forward.** Hapi's session strategy
  preloads every user's `memberships` and `organization_roles` (`user-service.ts`), and hapi's
  `can(...)` checks read them for every module still on hapi. On the Nest side, the todos ACL adapter
  reads `public.memberships`; billing's, once merged, also reads `public.organization_roles`. Once the
  group is proxied, the Nest module's tables receive membership, role and organization changes and the
  legacy ones do not, so all of those readers would go stale. Flipping the group together does not
  solve this. The owner chose:
  - **Hapi-side readers: a reverse forward.** From the write flip until the hapi readers leave (user
    and auth move), the Nest organization module forwards each change to `organizations`,
    `memberships` and `organization_roles` back to hapi after it commits (an after-commit
    subscription calling an internal write API on hapi behind the inter-service token). This is the
    mirror image of the dual-write. Hapi writes its own tables, and Nest never writes `public`. The
    reverse forward is in place, with its tests, **before** any operation of `organization-writes` is
    proxied. It is scaffolding: it goes at `data-moved` with the rest, which is outside this
    experiment.
  - **Nest-side readers: switch to the Nest module.** The todos (and billing) ACL adapters ask the
    organization module's policy query instead of `public`. They switch after the backfill is attested,
    when the replica is complete, and no later than the layer that proxies the group.
  - **Stated in the plan, not checked by the campaign.** Arm A's and arm B's plan document both state
    the two rules. The campaign has no objective for them: "this Nest write is forwarded back" cannot be
    detected by shape without guessing, and the definition is frozen. The auditor checks them as I9 and
    I10, so both arms are scored the same way.
- **D2's archive write.** `PUT /orgs/{orgId}/archive` writes `organizations` rows, so it joins
  `organization-writes`. The campaign's table names the group's operations as of this appendix and
  does not learn the new route; only an agent that adds it to `SHARED_STATE_GROUPS` makes the
  objective check it. The auditor scores I3 and I4 with the archive route in the group either way.
- **Readers in a second file.** `shared-state-split` judges one route file at a time. The group is
  in one file, so it is checked whole; the reads-first ordering, which would span
  `organization-cli-routes.ts`, is not checked by the campaign (see `02-engine-fixes.md`).

## Appendix B — operator answer sheet

Written 2026-10-06, before the pilot. The operator answers a question with the matching entry
**verbatim**, and anything else with "Use your judgement." The wording is the same in both arms. No
answer names the campaign, the plan's status checklist, or anything only one arm has.

**Before each run (setup, not an answer).** Each run gets its own databases, `ab-<run>-dev` and
`ab-<run>-test`, created empty and named in the arm branch's `.env` as `DATABASE_URL` and
`DATABASE_URL_TEST`. The operator runs `pnpm bootstrap` against them once, so the run starts migrated
and seeded. Two runs never share a database: integration suites truncate, and a backfill run against
another run's data would be meaningless.

| The agent asks about…                                                      | Answer                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| pushing, opening PRs, or a remote                                          | "Do not push. Keep the stack local; the review happens after the run."                                                                                 |
| which database to use                                                      | "`DATABASE_URL` in `.env` is your development database and `DATABASE_URL_TEST` your test database. Both are yours alone for this work."                |
| whether to run the backfill for real                                       | "Yes. Run it against the development database, after it has been migrated and seeded, and keep its output. Recording that it ran is part of the work." |
| production data, a staging environment, or a maintenance window            | "There is none. The development database stands in for production."                                                                                    |
| acceptance tests, Playwright, or Zitadel                                   | "The acceptance suite needs a Zitadel instance this environment does not have. Do not run it. The unit and integration suites are the gates."          |
| a failing test in another module that the work did not touch               | "Rerun it once. If it fails again and the change cannot have caused it, note it and carry on."                                                         |
| changing user, auth, todos or billing code                                 | "Change what the work needs, and nothing else."                                                                                                        |
| the wallet call inside organization creation                               | "Use your judgement. The wallet is a Nest module already."                                                                                             |
| how big a layer should be                                                  | "One reviewable change per layer: a reviewer should be able to approve or reject it on its own."                                                       |
| whether to stop, or what to do when stuck                                  | "Keep going until the sector reaches routes-moved or you are blocked. If you are blocked, say what blocks you and what is left."                       |
| a change on the branch that the agent did not make (D2)                    | "It is a teammate's change, and it has landed. Treat it as you would any change on main."                                                              |
| whether the archive route (D2) is part of the work                         | "Use your judgement."                                                                                                                                  |
| permission to skip a step, or to reorder the plan                          | "The plan is the plan. If you think it is wrong, say why, and follow it."                                                                              |
| D3's request ("served from the Nest server today"), if the agent asks back | "It is what the team asked for. Use your judgement."                                                                                                   |
| time or token budget                                                       | "There is no budget for this work. Do it properly."                                                                                                    |
