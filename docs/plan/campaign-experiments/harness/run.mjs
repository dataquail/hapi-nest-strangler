#!/usr/bin/env node
// Experiment 1 harness (see ../01-seeded-faults.md). Run from the main checkout:
//
//   node docs/plan/campaign-experiments/harness/run.mjs --worktree <path> [--only F1,F2] [--skip-controls]
//
// For each entry: reset the scratch worktree to the entry's branch, apply the
// fault, stage it, run the gates, record exit codes and full logs, reset.
// Results land in ../results/raw/<campaigns-version>/ (one JSON + logs per entry).

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

import { entries } from "./entries.mjs";

const HERE = import.meta.dirname;
const RESULTS = path.join(HERE, "..", "results");

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const worktree = flag("--worktree");
if (!worktree || !existsSync(worktree))
  throw new Error("--worktree <existing scratch worktree> is required");
const only = flag("--only")?.split(",");
const skipControls = args.includes("--skip-controls");
// Apply each entry and record its diff, run no gate: proves every fault still applies.
const dry = args.includes("--dry");
const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/hapi-strangler-test";

const sh = (cmd, opts = {}) => {
  const started = Date.now();
  const res = spawnSync("bash", ["-lc", cmd], {
    cwd: opts.cwd ?? worktree,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...(opts.env ?? {}) },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: opts.timeout ?? 20 * 60 * 1000,
  });
  return {
    cmd,
    exit: res.status ?? (res.signal ? `signal:${res.signal}` : "unknown"),
    ms: Date.now() - started,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
};
const must = (cmd, opts) => {
  const res = sh(cmd, opts);
  if (res.exit !== 0) throw new Error(`${cmd} failed (${res.exit}):\n${res.stdout}\n${res.stderr}`);
  return res;
};

const git = (...a) => execFileSync("git", a, { cwd: worktree, encoding: "utf8" }).trim();

const pins = () => {
  const read = (pkg) =>
    JSON.parse(
      readFileSync(path.join(worktree, "node_modules", "@goodbones", pkg, "package.json"), "utf8"),
    ).version;
  return Object.fromEntries(
    ["core", "typescript", "cli", "oxlint", "campaigns"].map((p) => [p, read(p)]),
  );
};

// --- the edit helpers handed to each entry's apply() --------------------------

const ctx = {
  worktree,
  sh: must,
  // Non-throwing; the output is kept on the record, for steps whose outcome is the observation.
  run(record, name, cmd) {
    const res = sh(cmd);
    record.steps.push({
      step: name,
      ...pick(res),
      stdout: res.stdout.slice(0, 4000),
      stderr: res.stderr.slice(0, 2000),
    });
    process.stdout.write(`  ${name} exit ${res.exit}\n`);
    return res;
  },
  file: (rel) => path.join(worktree, rel),
  read: (rel) => readFileSync(path.join(worktree, rel), "utf8"),
  write: (rel, text) => {
    mkdirSync(path.dirname(path.join(worktree, rel)), { recursive: true });
    writeFileSync(path.join(worktree, rel), text);
  },
  // Exact, single-occurrence replacement; a missing or ambiguous anchor is an error.
  replace(rel, anchor, replacement) {
    const text = ctx.read(rel);
    const count = text.split(anchor).length - 1;
    if (count !== 1) throw new Error(`${rel}: anchor found ${count} times:\n${anchor}`);
    ctx.write(
      rel,
      text.replace(anchor, () => replacement),
    );
  },
  patch(name) {
    must(
      `git apply --whitespace=nowarn ${JSON.stringify(path.join(HERE, "patches", `${name}.patch`))}`,
    );
  },
  checkoutFrom(ref, rel) {
    must(`git checkout ${ref} -- ${JSON.stringify(rel)}`);
  },
};

// --- the gates ---------------------------------------------------------------

const G7_PROJECTS = ["@org/server", "@org/legacy-api", "@org/database"];
const gateCommands = (branch) => ({
  G1: "pnpm -s campaigns:nudge",
  G2: `pnpm -s exec architecture campaigns status --changed --base campaign/${branch} packages`,
  G3: "pnpm -s lint:architecture",
  G4: "pnpm -s lint",
  G5: "pnpm -s check",
  G6: "pnpm -s test",
  // The Nest suite's setup only migrates the legacy tables; a migration applied on an
  // earlier entry's branch and absent on this one would make knex refuse, so reset first.
  G7: [
    "pnpm -s -F @org/legacy-api db:reset:test",
    ...G7_PROJECTS.map((p) => `TEST_INTEGRATION=true pnpm -s exec vitest run --project=${p}`),
  ],
});

const runGate = (id, cmd) => {
  if (Array.isArray(cmd)) {
    const parts = cmd.map((c) => sh(c, { env: { DATABASE_URL_TEST } }));
    const failed = parts.find((p) => p.exit !== 0);
    return {
      cmd: cmd.join(" && "),
      exit: failed ? failed.exit : 0,
      ms: parts.reduce((a, p) => a + p.ms, 0),
      stdout: parts.map((p) => `### ${p.cmd} (exit ${p.exit})\n${p.stdout}`).join("\n"),
      stderr: parts.map((p) => `### ${p.cmd}\n${p.stderr}`).join("\n"),
      parts: parts.map((p) => ({ cmd: p.cmd, exit: p.exit })),
    };
  }
  return sh(cmd, id === "G1" || id === "G2" || id === "G3" ? {} : { env: { DATABASE_URL_TEST } });
};

// --- one entry ---------------------------------------------------------------

let lastLockHash = null;
const lockHash = () =>
  createHash("sha1")
    .update(readFileSync(path.join(worktree, "pnpm-lock.yaml")))
    .digest("hex");

const reset = (branch) => {
  must(`git checkout -q --detach campaign/${branch} && git reset -q --hard && git clean -fdq`);
  const hash = lockHash();
  if (hash !== lastLockHash) {
    must("pnpm install --frozen-lockfile --silent", { timeout: 15 * 60 * 1000 });
    lastLockHash = hash;
  }
};

const runEntry = (entry, outDir) => {
  const started = new Date().toISOString();
  process.stdout.write(`\n=== ${entry.id} on ${entry.branch}\n`);
  reset(entry.branch);
  const head = git("rev-parse", "--short", "HEAD");
  const record = {
    id: entry.id,
    kind: entry.kind,
    branch: entry.branch,
    head,
    started,
    steps: [],
    gates: {},
  };

  entry.apply?.(ctx, record);
  must("git add -A");
  record.diffStat = git("diff", "--cached", "--stat");
  // Built contracts are ignored by git and survive a reset; rebuild so every gate
  // sees this branch's (and this fault's) contracts.
  record.steps.push({ step: "contracts build", ...pick(sh("pnpm -s -F @org/contracts build")) });

  const commands = gateCommands(entry.branch);
  const gates = dry ? [] : (entry.gates ?? ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
  const logDir = path.join(outDir, entry.id);
  mkdirSync(logDir, { recursive: true });

  for (const id of gates) {
    if (id === "G2") {
      // Base mode needs the fault committed on the detached HEAD.
      must(
        `git -c user.name=harness -c user.email=harness@local commit -q --no-verify --allow-empty -m "fault ${entry.id}"`,
      );
    }
    const res = runGate(id, commands[id]);
    writeFileSync(
      path.join(logDir, `${id}.log`),
      `$ ${res.cmd}\nexit ${res.exit}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`,
    );
    record.gates[id] = { exit: res.exit, ms: res.ms, ...(res.parts ? { parts: res.parts } : {}) };
    process.stdout.write(`  ${id} exit ${res.exit} (${Math.round(res.ms / 1000)}s)\n`);
  }

  for (const [name, cmd] of dry ? [] : (entry.after ?? [])) {
    const res = sh(cmd);
    writeFileSync(
      path.join(logDir, `${name}.log`),
      `$ ${cmd}\nexit ${res.exit}\n\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`,
    );
    record.steps.push({ step: name, ...pick(res), stdout: res.stdout.slice(0, 4000) });
    process.stdout.write(`  ${name} exit ${res.exit}\n`);
  }

  record.finished = new Date().toISOString();
  writeFileSync(path.join(outDir, `${entry.id}.json`), JSON.stringify(record, null, 2));
  must("git reset -q --hard && git clean -fdq");
  return record;
};

const pick = ({ cmd, exit, ms }) => ({ cmd, exit, ms });

// --- main --------------------------------------------------------------------

const selected = entries.filter(
  (e) => (only ? only.includes(e.id) : true) && !(skipControls && e.kind === "control"),
);
reset(selected[0].branch);
const versions = pins();
const outDir = path.join(RESULTS, dry ? "dry" : "raw", `campaigns-${versions.campaigns}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "pins.json"), JSON.stringify(versions, null, 2));
process.stdout.write(`engine pins: ${JSON.stringify(versions)}\n`);

const failures = [];
for (const entry of selected) {
  try {
    runEntry(entry, outDir);
  } catch (error) {
    failures.push(entry.id);
    process.stdout.write(`  HARNESS ERROR in ${entry.id}: ${error.message}\n`);
    writeFileSync(path.join(outDir, `${entry.id}.error.txt`), String(error.stack ?? error));
    sh("git reset -q --hard && git clean -fdq");
  }
}
process.stdout.write(`\ndone; harness errors: ${failures.length ? failures.join(", ") : "none"}\n`);
process.exit(failures.length ? 1 : 0);
