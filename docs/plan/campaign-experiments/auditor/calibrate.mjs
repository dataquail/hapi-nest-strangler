#!/usr/bin/env node
// Calibrate the auditor on billing, where the answers are known: the clean stack must
// carry no violation, and experiment 1's faults must land on the invariant they break.
//
//   node docs/plan/campaign-experiments/auditor/calibrate.mjs --worktree <scratch worktree>
//
// Each fault is applied by the experiment-1 harness's own entry, committed on a detached
// HEAD in the scratch worktree, and audited as the top of the billing stack up to its branch.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { entries } from "../harness/entries.mjs";

const HERE = import.meta.dirname;
const REPO = path.resolve(HERE, "..", "..", "..", "..");
const args = process.argv.slice(2);
const worktree = args[args.indexOf("--worktree") + 1];

const LAYERS = [
  "plan",
  "fenced",
  "rebuilt",
  "mirror-start",
  "mirror-cancel",
  "mirror-webhook",
  "backfill",
  "attest",
  "serve-read",
  "serve-writes-nest",
  "serve-writes-proxy",
  "retire-internal",
  "routes-moved",
  "data-moved",
  "settled",
];
const START = "00f59e7";
const stackUpTo = (branch) => [
  START,
  ...LAYERS.slice(0, LAYERS.indexOf(branch.replace(/^billing-/, "")) + 1).map(
    (b) => `exp1/billing-${b}`,
  ),
];

// What each fault should be found as; null means no invariant covers it. F2 (a new route
// outside the declared groups) is left out: its edit regenerates the contracts, which needs
// an installed worktree, and no invariant covers it (organization's archive route is I4).
const EXPECTED = {
  F1: null, // an unmirrored write before the backfill is recorded is still allowed
  F1b: null, // the same, one layer later: the backfill is written but not recorded
  F4: "I2",
  F5: "I3",
  F6: "I1",
  F7: "I6",
  F8: "I5",
  F9: null, // a Nest-side boundary, the lint's job
  F10: null, // semantics no invariant states
};

const must = (cmd) => {
  const res = spawnSync("bash", ["-lc", cmd], { cwd: worktree, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`${cmd}:\n${res.stdout}\n${res.stderr}`);
  return res;
};
const ctx = {
  worktree,
  sh: must,
  run: () => ({ exit: 0, stdout: "" }),
  file: (rel) => path.join(worktree, rel),
  read: (rel) => readFileSync(path.join(worktree, rel), "utf8"),
  write: (rel, text) => {
    mkdirSync(path.dirname(path.join(worktree, rel)), { recursive: true });
    writeFileSync(path.join(worktree, rel), text);
  },
  replace(rel, anchor, replacement) {
    const text = ctx.read(rel);
    if (text.split(anchor).length !== 2) throw new Error(`${rel}: anchor not unique`);
    ctx.write(
      rel,
      text.replace(anchor, () => replacement),
    );
  },
  patch: (name) =>
    must(
      `git apply --whitespace=nowarn ${JSON.stringify(path.join(HERE, "..", "harness", "patches", `${name}.patch`))}`,
    ),
  checkoutFrom: (ref, rel) => must(`git checkout ${ref} -- ${JSON.stringify(rel)}`),
};

const audit = (stack) => {
  const res = spawnSync(
    "node",
    [
      path.join(HERE, "audit.mjs"),
      "--sector",
      "billing",
      "--repo",
      worktree,
      "--stack",
      stack.join(","),
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(res.stderr);
  return res.stdout
    .split("\n")
    .filter((l) => l.startsWith("violation"))
    .map((l) => l.split(/\s+/)[1]);
};

const rows = [];
const clean = audit([START, ...LAYERS.map((b) => `exp1/billing-${b}`)]);
rows.push({ id: "clean stack", expected: "none", found: clean, ok: clean.length === 0 });

for (const entry of entries.filter((e) => e.kind === "fault" && e.id in EXPECTED)) {
  must(`git reset -q --hard && git clean -fdq && git checkout -q --detach exp1/${entry.branch}`);
  entry.apply(ctx, { steps: [] });
  must(
    `git add -A && git -c user.name=calibrate -c user.email=calibrate@local commit -q --no-verify -m "fault ${entry.id}"`,
  );
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: worktree,
    encoding: "utf8",
  }).trim();
  const found = [...new Set(audit([...stackUpTo(entry.branch), sha]))];
  const expected = EXPECTED[entry.id];
  rows.push({
    id: entry.id,
    expected: expected ?? "none",
    found,
    ok: expected === null ? found.length === 0 : found.length === 1 && found[0] === expected,
  });
}
must("git reset -q --hard && git clean -fdq");

for (const r of rows)
  process.stdout.write(
    `${r.ok ? "ok  " : "MISS"} ${r.id.padEnd(12)} expected ${r.expected.padEnd(5)} found ${r.found.join(",") || "none"}\n`,
  );
process.exit(rows.every((r) => r.ok) ? 0 : 1);
