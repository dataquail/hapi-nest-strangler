# Experiment 1 — seeded faults, rerun on campaigns 0.1.1-beta.6 (gate 3 again)

Engine: core / typescript `0.1.0-beta.15`, cli / oxlint `0.1.0-beta.17`, campaigns `0.1.1-beta.6`. Date:
2026-10-06. Campaign definition: `campaign/goodbones-beta-17` at `8ec6be2`. That is `main` plus
`onAhead: ignore` on `no-hapi-files`, receipted on `gone` (`02b-objective-onahead.md`). Harness:
`../harness/run.mjs --campaign-from 8ec6be2 --overlay-base 00f59e7 --carry-pins`, unchanged since beta.5. Raw:
`seeded-faults-campaigns-0.1.1-beta.6.json` and `raw/campaigns-0.1.1-beta.6/`. Stack replay:
`raw/campaigns-0.1.1-beta.6-replay/stack.json`.

This rerun checks one change against `seeded-faults-campaigns-0.1.1-beta.5.md`: R9, the ordering check (O1)
refusing ordinary deletions through `no-hapi-files`.

## The pin bump

In this repository, `lint`, `lint:rules`, `lint:edges`, `lint:architecture`, `campaigns`, the nudge and `test`
pass on the bump, and `campaigns:clear` changes no ledger and no `plan.json`. The exemption, in its own commit,
moves only `gone`'s hash in `plan.json` (`629d7e43` → `2a0cd401`, concessions 1 → 2). The brief predicted
both. On every harness entry, the overlay's `clear` left each existing objective at `nothing to clear`.

## Result

- **Every exit code on every gate equals beta.5's**, except P1's G1 and G2: 1 → 0. All eight controls pass all
  seven gates on the first run.
- **Every G1, G2 and G3 log is text-identical to beta.5's** apart from timings, the `--base` SHA and P1. So
  are the F7, F11, F11b and P2–P4 step outputs.
- **F4 is still caught** on both nudges: `ahead of plan: has-nest-endpoints −1 belongs to served ·
routes-still-local −1 belongs to served; billing is at backfilled (not yet attested) — onAhead: ratchet`.
- **P1 now passes**: `this diff: −no-hapi-routes: billing-routes.ts  forward`, `onTouch: ratchet (of
routes-moved) — ok`, with no `ahead of plan` line.

The fault table is therefore beta.5's, unchanged. 9 of 11 faults are caught by the campaign alone, and F10 is
missed by every gate.

## Stack replay

All 14 layers of the billing stack exit 0 on the CI nudge. `fenced`, `serve-writes-proxy` and `routes-moved`,
the three beta.5 refused, now read `ok`, and no layer prints `ahead of plan`.

## Gate 3

Passed, R9 included. Every catch holds, every fix behaves, and the campaign refuses none of the billing stack's
legitimate layers. The engine and definition here are the candidates for the freeze in
`03-ab-plan-vs-campaign.md`. The freeze itself waits for the billing stack to merge into `main`, since the
A/B's starting commit `S` includes it.
