#!/usr/bin/env node
// Replay the billing stack's own layers through the CI nudge under the overlay:
//
//   node docs/plan/campaign-experiments/harness/replay-stack.mjs --worktree <path> --overlay <patch> \
//     --pins '<json>' [--out <file>]
//
// The controls of run.mjs have no diff, so they cannot show the campaign refusing
// legitimate work. Here each layer is judged against its parent, both carrying the
// same overlay (definition + pins, ledgers seeded by clear): what CI would say of
// the stack had it been built on the new engine and definition.
// Assumes node_modules already holds the overlay's engine (run.mjs leaves it so).

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const worktree = flag("--worktree");
const overlayFile = flag("--overlay");
const pins = JSON.parse(flag("--pins"));
const out = flag("--out");

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

const git = (...a) => execFileSync("git", a, { cwd: worktree, encoding: "utf8" }).trim();
const sh = (cmd) =>
  spawnSync("bash", ["-lc", cmd], {
    cwd: worktree,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
const must = (cmd) => {
  const res = sh(cmd);
  if (res.status !== 0) throw new Error(`${cmd} failed:\n${res.stdout}\n${res.stderr}`);
  return res;
};

const overlaid = (branch) => {
  must(`git checkout -q --detach exp1/billing-${branch} && git reset -q --hard && git clean -fdq`);
  must(`git apply --3way ${JSON.stringify(overlayFile)}`);
  let manifest = readFileSync(`${worktree}/package.json`, "utf8");
  for (const [name, version] of Object.entries(pins))
    manifest = manifest.replace(new RegExp(`("${name}": )"[^"]+"`), `$1"${version}"`);
  writeFileSync(`${worktree}/package.json`, manifest);
  must("pnpm -s campaigns:clear");
  must("git add -A");
  must(
    `git -c user.name=harness -c user.email=harness@local commit -q --no-verify -m "overlay ${branch}"`,
  );
  return git("rev-parse", "HEAD");
};

const rows = [];
for (let i = 1; i < LAYERS.length; i++) {
  const base = overlaid(LAYERS[i - 1]);
  overlaid(LAYERS[i]);
  const res = sh(`pnpm -s exec architecture campaigns status --changed --base ${base} packages`);
  const lines = res.stdout.split("\n");
  const pick = (re) => lines.filter((l) => re.test(l)).map((l) => l.trim());
  const row = {
    layer: LAYERS[i],
    exit: res.status,
    verdicts: pick(/onTouch:/),
    ahead: pick(/ahead of plan:/),
    stdout: res.stdout,
  };
  rows.push(row);
  process.stdout.write(
    `${row.layer.padEnd(20)} exit ${row.exit}  ${row.verdicts.join(" | ")}${row.ahead.length ? `\n${" ".repeat(22)}${row.ahead.join("\n" + " ".repeat(22))}` : ""}\n`,
  );
}
must("git reset -q --hard && git clean -fdq");
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
