# Does a campaign beat a plan document? The experiment programme

## The question

The objection to answer, in the form a skeptical senior engineer would put it:

> You have not shown that the goodbones campaign is any better than writing the refactor plan as a
> document that every agent must load into context. The document anchors the agent to the
> refactor and to its phases just as well.

For one careful agent moving one sector in one sitting, the evidence so far does not refute this:
billing went `fenced` → `settled` cleanly, but no layer ever gave the campaign a mistake to catch.
Its value there was ordering the work and checking the definition of done; its correcting half
never fired (see `../campaign-rough-edges-billing.md`). The programme below tests the claim
directly, in an order where each step's result decides what the next step does.

**The hypothesis under test.** A plan document is an _instruction the agent reads_; a campaign is
a _check run on the code_. If that difference matters, it shows in three places a document cannot
reach: claims of progress that the code contradicts, contributors (or sessions) that never loaded
the document, and drift over time. If it does not matter, a document is the cheaper tool and the
campaign is not worth its authoring cost (about 300 lines of YAML and detector code here).

## Starting point (2026-10-05)

| Thing                                             | Where                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Engine pins                                       | `@goodbones/{core,typescript,cli,oxlint}` `0.1.0-beta.15`, `@goodbones/campaigns` `0.1.1-beta.4`   |
| Billing stack, `fenced` → `settled`, 15 layers    | GitHub stack #35, draft PRs #20–#34, branches `campaign/billing-plan` … `campaign/billing-settled` |
| Findings from billing (B1–B21, actions C1–C10)    | `docs/plan/campaign-rough-edges-billing.md`                                                        |
| Findings from todo (entries 1–43, actions A1–A10) | `docs/scratch/campaign-rough-edges.md` in the main checkout (untracked)                            |
| Campaign definition                               | root `architecture.yaml`, key `campaigns.strangle-hapi`; `campaigns/strangle-hapi.mjs`             |
| Test database used so far                         | `postgresql://postgres:postgres@localhost:5432/hapi-strangler-test`                                |

## The order, with gates

```
 Step 1  Experiment 1, baseline ............ 01-seeded-faults.md      (current pins)
           │  gate 1: decide the fix list from the results
 Step 2  Engine fixes ...................... 02-engine-fixes.md       (goodbones repo, separate session)
           │  gate 2: new beta published, pins bumped here, repo checks green
 Step 3  Experiment 1, rerun ............... 01-seeded-faults.md      (new pins)
           │  gate 3: nothing regressed; fixed items behave
 Step 3b Campaign objectives for F5/F6 ..... 03b-campaign-objectives.md (this repo)
           │  gate 3b: F5/F6 caught; no other verdict moved; FREEZE engine + campaign
 Step 4  Experiment 2, A/B ................. 03-ab-plan-vs-campaign.md (frozen pins + campaign)
           │
 Step 5  Write-up for the decision ......... template at the end of this file
```

### Step 1 — Experiment 1, baseline (`01-seeded-faults.md`)

Plant the mistakes a strangling actually goes wrong on into the billing stack's branches, one at a
time, in throwaway worktrees, and record what the campaign says about each — and, as the control,
what every _other_ gate in the repository says (tests, lint, type-check). It needs no agent and
no luck: each fault is a fixed patch, so the result is a deterministic table. It also contains
_visibility probes_ for the C-actions (things that are not faults but that the fixes should
change), so the same harness becomes the regression suite for step 2.

Run it first, on the current pins, before anything is fixed: it is the baseline, and it is what
tells you which fix matters most.

**Gate 1 — decided 2026-10-06.** The baseline is
`results/seeded-faults-campaigns-0.1.1-beta.4.md`. F4 was missed by every gate, so O1 is in. The run also
found three engine bugs (R1, R2, R3), and C6 turned out cheap. The fix list, with corrected causes, is
`02-engine-fixes.md`. F5 and F6 can be written as campaign objectives with existing terms, so they move to
step 3b instead of the engine. The rule below is how the list was decided, kept for the record:

- Always in the list: C1 (deleted files invisible), C2 (`clear` says "went back" on a forward
  move), C3 (notes cut at 500 characters), C4 (no per-sector view). Each distorts what an agent
  sees during exactly the disturbances experiment 2 applies. C6 (holdout keys follow the nearest
  binding) if the goodbones session judges it cheap.
- Conditional — the **ordering check (O1)**: add it if faults F4 and F5 (work done ahead of its
  phase; operations that share state flipped separately) come back _missed by every gate_, which
  is the prediction. Ordering is the one thing a plan document is good at and the campaign does
  not check; leaving it out would test a campaign with a known hole against a document without one.
- Everything else from C5–C10 and the docs list: not now. None changes what an agent does
  mid-sector. Record them for later.

### Step 2 — Engine fixes (`02-engine-fixes.md`)

Hand `02-engine-fixes.md` and the findings log to a separate session working in the goodbones
repository. It is a self-contained brief: each fix has its reproduction on a billing branch, its
acceptance criterion tied to an experiment-1 probe or fault ID, and the release-and-pin procedure
for this repo.

**Gate 2.** A new goodbones beta is published; this repo's pins are bumped in one commit; `pnpm
lint`, `pnpm lint:rules`, `pnpm lint:edges`, `pnpm lint:architecture` and `pnpm campaigns` pass
with no ledger edits beyond what the brief predicts.

### Step 3 — Experiment 1, rerun

Rerun the identical harness (`harness/run.mjs`) on the new pins. Compare row by row with the baseline.

**Gate 3.** Every fault that was _caught_ is still caught (no regressions). Every probe the fixes target
now shows the intended output. F4 is caught (O1), and F3, F7 and F11 behave as `02-engine-fixes.md`'s
R1, R3 and R2 say.

### Step 3b — Campaign objectives for F5 and F6 (this repo)

The campaign covers every hapi sector, not only billing, so the objectives experiment 1 showed missing are
worth having whatever the A/B finds. They are written in `architecture.yaml` (`campaigns.strangle-hapi`)
and `campaigns/strangle-hapi.mjs`, each with its probe:

- **F5, shared state flips together.** The operations of a shared-state group are all local or all
  proxied, never split. The groups are named per sector: write `03-ab-plan-vs-campaign.md`'s Appendix A
  (organization's groups) first, and declare billing's (start, cancel, webhook) so the harness can test
  the objective.
- **F6, the mirror follows the write.** An ast-grep `syntax` rule (`precedes`/`follows`): a method's
  mirror emit comes after the write it announces.

Write them by shape, not by billing's names. Arm A's plan document must state the same groups and the same
ordering rule, so the arms differ only in whether the rules are checked. A plan change goes in its own
commit with its receipt, as any change to the campaign does.

**Gate 3b.** Rerun the harness: F5 and F6 are now caught, and no other fault or control changes its
verdict. Then **freeze**: record the exact engine versions and the campaign definition's commit at the
top of `03-ab-plan-vs-campaign.md`, and do not change either until step 4 is finished. The A/B must test
the version you would hand to the team, not one tuned between runs. The write-up says the campaign was
extended after experiment 1.

### Step 4 — Experiment 2, A/B (`03-ab-plan-vs-campaign.md`)

The experiment that answers the objection. Two arms start from the same commit and strangle the
same sector: arm A carries a plan document with the same phases, intents and instructions,
forced into context, and no detectors or gate; arm B carries the campaign. Both are put through
the same disturbances — a cold restart mid-sector, a handoff between sessions, a second
contributor making an unrelated change to the legacy module, an instruction that tempts a shortcut
— and both stacks are scored by an auditor that does not use the campaign's own detectors.
Several runs per arm; one run each is an anecdote.

### Step 5 — Write-up

Use the template below. Report experiment 1 (what the checks can and cannot see, with the gaps
stated plainly) and experiment 2 (whether that matters under realistic disturbance) separately:
the first is a capability statement, the second is the answer to the objection.

## Decision rules, fixed in advance

Written before any result exists, so the result cannot move them.

| Outcome of experiment 2                                                                                   | Conclusion                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arm B has materially fewer invariant violations and false "done" claims, at comparable cost               | The campaign earns its authoring cost for multi-session, multi-contributor migrations                                                             |
| The arms tie on violations                                                                                | The plan document is sufficient; the campaign's remaining value is reporting (ledgers in PRs, a status headline), which must be argued on its own |
| Arm A is better                                                                                           | The campaign's overhead (ceremony, false positives, tool bugs) costs more than its checks return; say why                                         |
| Arm B wins only on disturbances a document cannot see by construction (a contributor who never loaded it) | Narrower claim: the campaign is a CI gate, not an agent aid; present it as such                                                                   |

"Materially" is defined in `03-ab-plan-vs-campaign.md` before the runs start.

## Who does what

| Step | Who                                                     | Produces                                          | Lands in                                     |
| ---- | ------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| 1, 3 | a session in this repo                                  | `results/seeded-faults-<pins>.md` + raw JSON      | `docs/plan/campaign-experiments/results/`    |
| 3b   | a session in this repo                                  | the F5/F6 objectives; Appendix A; a harness rerun | `main` via its own PR; `results/`            |
| 2    | a session in the goodbones repo                         | a beta release; a pin-bump commit here            | goodbones; this repo's `main` via its own PR |
| 4    | an orchestrating session + fresh agent sessions per run | one stack per run, audit reports, a scoring sheet | `results/ab/`                                |
| 5    | the owner                                               | the write-up                                      | wherever the decision is made                |

## Write-up template

```
# Campaign vs plan document: results

Engine version tested: …            Sector: …            Runs per arm: …

## What the checks can see (experiment 1)
Faults caught by the campaign and by nothing else: …/…
Faults caught by the campaign and also by other gates: …
Faults missed by every gate (stated plainly): …
What the engine fixes changed (baseline → rerun): …

## Does it matter in practice (experiment 2)
| Metric | Arm A (plan doc) | Arm B (campaign) |
| invariant violations per run (mean, range) | | |
| false "done" claims | | |
| leftovers at routes-moved | | |
| layers needing rework after review | | |
| agent cost (tokens, wall time) per run | | |
| concessions / false positives the campaign raised | — | |

Per disturbance, what each arm did: …

## Conclusion against the decision rules
…

## Threats to validity
…
```
