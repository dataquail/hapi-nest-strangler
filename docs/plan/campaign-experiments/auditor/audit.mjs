#!/usr/bin/env node
// The A/B's auditor (../03-ab-plan-vs-campaign.md, "The auditor"). It reads each layer
// straight from git and judges the invariants with its own TypeScript-AST queries: no
// `architecture campaigns`, no ledger counts, no manifest detector. The one campaign file
// it may read is arm B's attestation, as the record that the backfill ran (I2).
//
//   node docs/plan/campaign-experiments/auditor/audit.mjs --sector organization \
//     --stack <ref>,<ref>,… [--backfill campaign | --backfill plan:<path>:<regex>] [--out <file>]
//
// --stack is the run's layers bottom to top; the first is the starting commit S.
// --backfill decides where "the backfill was run and recorded" is read from: arm B's
// attestation (default), or a line of arm A's plan document matching <regex>.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

import { sectors } from "./sectors.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const sectorName = flag("--sector");
const sector = sectors[sectorName];
if (sector === undefined) throw new Error(`--sector: one of ${Object.keys(sectors).join(", ")}`);
const stack = (flag("--stack") ?? "").split(",").filter(Boolean);
if (stack.length === 0) throw new Error("--stack <ref>,<ref>,… is required");
const backfillFrom = flag("--backfill") ?? "campaign";
const out = flag("--out");
const repo = flag("--repo") ?? process.cwd();

// --- reading a layer from git ------------------------------------------------

const git = (...a) =>
  execFileSync("git", a, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
const listFiles = (ref, prefix) =>
  git("ls-tree", "-r", "--name-only", ref, "--", prefix).split("\n").filter(Boolean);
const readAt = (ref, file) => {
  try {
    return git("show", `${ref}:${file}`);
  } catch {
    return null;
  }
};
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const walk = (node, visit) => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};
const isTest = (file) => /\.(spec|test)\.ts$|\/test\/|\/test-utils\//.test(file);

// --- routes ------------------------------------------------------------------

const propertyOf = (object, name) =>
  object.properties.find((p) => ts.isPropertyAssignment(p) && p.name && p.name.getText() === name)
    ?.initializer;

const routesIn = (file, text) => {
  const routes = [];
  walk(parse(file, text), (node) => {
    if (!ts.isObjectLiteralExpression(node)) return;
    const method = propertyOf(node, "method");
    const route = propertyOf(node, "path");
    const handler = propertyOf(node, "handler");
    if (!method || !route || !handler) return;
    if (!ts.isStringLiteral(method) || !ts.isStringLiteral(route)) return;
    const proxied =
      ts.isCallExpression(handler) && handler.expression.getText().endsWith("proxyToNest");
    routes.push({ op: `${method.text.toUpperCase()} ${route.text}`, file, proxied });
  });
  return routes;
};

const nestServedPatterns = (ref) => {
  const text = readAt(ref, "packages/web/services/api/upstreams.shared.ts");
  if (text === null) return [];
  const patterns = [];
  walk(parse("upstreams.shared.ts", text), (node) => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const literal = node.getText();
      const end = literal.lastIndexOf("/");
      patterns.push(new RegExp(literal.slice(1, end), literal.slice(end + 1)));
    }
  });
  return patterns;
};

const samplePath = (route) => route.replace(/\{[^}]+\}/g, "x");

// Where each operation stands: local (hapi serves it), moved (proxied by hapi, or sent to
// the Nest server by the web proxy), or absent (no hapi route and no Nest routing).
const operationsAt = (ref) => {
  const declared = new Map();
  for (const file of sector.routeFiles) {
    const text = readAt(ref, file);
    if (text !== null) for (const r of routesIn(file, text)) declared.set(r.op, r);
  }
  const patterns = nestServedPatterns(ref);
  const webNest = (op) => patterns.some((p) => p.test(samplePath(op.split(" ")[1])));
  const all = new Set([
    ...declared.keys(),
    ...sector.reads,
    ...Object.values(sector.groups).flat(),
  ]);
  const state = {};
  for (const op of all) {
    const route = declared.get(op);
    if (route?.proxied || webNest(op)) state[op] = "moved";
    else if (route) state[op] = "local";
    else state[op] = "absent";
  }
  return { state, declared: [...declared.keys()] };
};

// --- legacy writes and their forwards ----------------------------------------

const WRITE_METHODS = new Set(["insert", "update", "del", "delete", "upsert"]);

const knexTableOf = (expression) => {
  let table = null;
  walk(expression, (node) => {
    if (
      table === null &&
      ts.isCallExpression(node) &&
      /(^|\.)knex$/.test(node.expression.getText()) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      table = node.arguments[0].text.split(" ")[0];
  });
  return table;
};

const enclosingTransactionEnd = (node) => {
  for (let at = node.parent; at; at = at.parent) {
    if (
      ts.isCallExpression(at) &&
      ts.isPropertyAccessExpression(at.expression) &&
      at.expression.name.text === "transaction"
    )
      return at.getEnd();
  }
  return null;
};

const methodName = (node) => {
  if (ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) return node.name.getText();
  if (ts.isFunctionDeclaration(node)) return node.name?.getText() ?? null;
  return null;
};

const writesIn = (file, text) => {
  const writes = [];
  walk(parse(file, text), (node) => {
    const name = methodName(node);
    if (name === null) return;
    const emits = [];
    const found = [];
    walk(node, (inner) => {
      if (!ts.isCallExpression(inner)) return;
      if (inner.arguments.some((a) => /^mirrorEvents\./.test(a.getText())))
        emits.push(inner.getStart());
      const callee = inner.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        WRITE_METHODS.has(callee.name.text) &&
        /knex\(|\.transacting\(/.test(callee.expression.getText())
      ) {
        found.push({
          table: knexTableOf(callee.expression),
          start: inner.getStart(),
          committedAt: enclosingTransactionEnd(inner) ?? inner.getEnd(),
        });
      }
    });
    const seen = new Map();
    for (const write of found) {
      const nth = (seen.get(write.table) ?? 0) + 1;
      seen.set(write.table, nth);
      const forward = emits.some((e) => e >= write.committedAt)
        ? "after-commit"
        : emits.length > 0
          ? "before-commit"
          : "none";
      writes.push({
        key: `${path.basename(file)}#${name}#${write.table}#${nth}`,
        table: write.table,
        forward,
      });
    }
  });
  // A method nested in a class is visited once per enclosing declaration; keep the innermost.
  return [...new Map(writes.map((w) => [`${w.key}#${w.forward}`, w])).values()];
};

const legacyWritesAt = (ref) =>
  listFiles(ref, sector.legacyFolder)
    .filter((f) => /-service\.ts$/.test(f) && !isTest(f))
    .flatMap((f) => writesIn(f, readAt(ref, f) ?? ""));

// --- coupling, outside readers, the reverse forward ---------------------------

const applicationDir = "packages/legacy-api/src/application/";
const ownModule = path.basename(sector.legacyFolder);

const couplingAt = (ref) => {
  const modules = new Set(
    listFiles(ref, applicationDir).map((f) => f.slice(applicationDir.length).split("/")[0]),
  );
  const edges = new Set();
  for (const file of listFiles(ref, sector.legacyFolder).filter((f) => !isTest(f))) {
    const text = readAt(ref, file) ?? "";
    for (const m of text.matchAll(
      /from\s+["'](\.[^"']+)["']|require\(\s*["'](\.[^"']+)["']\s*\)/g,
    )) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1] ?? m[2]));
      const module = target.startsWith(applicationDir)
        ? target.slice(applicationDir.length).split("/")[0]
        : null;
      if (module && module !== ownModule && modules.has(module) && !module.endsWith(".ts"))
        edges.add(`import:${module}`);
    }
    for (const m of text.matchAll(/\["@require"\]\s*=\s*\[([^\]]*)\]/g))
      for (const id of m[1].matchAll(/["']([a-z-]+)\/[^"']+["']/g))
        if (id[1] !== ownModule && modules.has(id[1])) edges.add(`require:${id[1]}`);
  }
  return [...edges].sort();
};

const outsideReadsAt = (ref) => {
  if (sector.outsideReadTables.length === 0) return [];
  const table = new RegExp(`public\\.(${sector.outsideReadTables.join("|")})\\b`);
  return listFiles(ref, "packages/server/src")
    .filter((f) => f.endsWith(".ts") && !isTest(f))
    .filter((f) => table.test(readAt(ref, f) ?? ""));
};

// Candidates only: a human confirms that every outside-read table is forwarded back (I9).
const reverseForwardCandidatesAt = (ref) => {
  if (sector.outsideReadTables.length === 0) return [];
  const nest = listFiles(ref, sector.nestModule)
    .filter((f) => f.endsWith(".ts") && !isTest(f))
    .filter((f) => /subscribeAfterCommit|subscribe\(/.test(readAt(ref, f) ?? ""))
    .filter((f) => /legacy|hapi|fetch\(|Client/i.test(readAt(ref, f) ?? ""));
  const tables = new RegExp(`knex\\(\\s*["'](${sector.outsideReadTables.join("|")})["']`);
  const hapi = listFiles(ref, "packages/legacy-api/src")
    .filter((f) => f.endsWith(".ts") && !isTest(f) && !f.startsWith(sector.legacyFolder))
    .filter((f) => /internal|inter-?service/i.test(readAt(ref, f) ?? ""))
    .filter((f) => tables.test(readAt(ref, f) ?? ""));
  return [...nest, ...hapi];
};

// --- the backfill record ------------------------------------------------------

const backfillRecordedAt = (ref) => {
  if (backfillFrom === "campaign") {
    const text = readAt(ref, sector.attestationFile);
    if (text === null) return false;
    const record = JSON.parse(text);
    return (record.attested ?? []).some((a) => a.phase === "backfilled" && !a.revoked);
  }
  const [, file, ...pattern] = backfillFrom.split(":");
  const text = readAt(ref, file);
  return text !== null && new RegExp(pattern.join(":"), "m").test(text);
};

// --- judging one layer --------------------------------------------------------

const layerFacts = (ref) => {
  const { state, declared } = operationsAt(ref);
  return {
    ref,
    sha: git("rev-parse", "--short", ref).trim(),
    subject: git("log", "-1", "--format=%s", ref).trim(),
    operations: state,
    declared,
    writes: legacyWritesAt(ref),
    coupling: couplingAt(ref),
    outsideReads: outsideReadsAt(ref),
    reverseForward: reverseForwardCandidatesAt(ref),
    backfillRecorded: backfillRecordedAt(ref),
  };
};

const groupState = (facts, ops) => {
  const present = ops.filter((op) => facts.operations[op] !== "absent");
  const moved = present.filter((op) => facts.operations[op] === "moved");
  if (present.length === 0) return "absent";
  if (moved.length === 0) return "local";
  return moved.length === present.length ? "moved" : "split";
};

const judge = (layers) => {
  const findings = [];
  const add = (invariant, layer, detail, verdict = "violation") =>
    findings.push({ invariant, layer: layer.sha, subject: layer.subject, verdict, detail });
  const baseline = layers[0];
  const firstMoveIndex = layers.findIndex((l) =>
    Object.values(l.operations).some((s) => s === "moved"),
  );

  layers.forEach((layer, index) => {
    if (index === 0) return;
    const groups = Object.entries(sector.groups).map(([name, ops]) => [
      name,
      ops,
      groupState(layer, ops),
    ]);
    const anyGroupMoved = groups.some(([, , s]) => s === "moved" || s === "split");

    // I1: once the backfill is recorded every legacy write is forwarded after it commits,
    // until its group moves (a legacy write left after that is I5's); a forward that
    // precedes its commit is a violation whenever it appears.
    for (const write of layer.writes) {
      if (write.forward === "before-commit")
        add("I1", layer, `${write.key}: forwarded before it commits`);
      else if (write.forward === "none" && layer.backfillRecorded && !anyGroupMoved)
        add("I1", layer, `${write.key}: not forwarded, and the backfill is recorded`);
    }
    // I2: nothing served by the Nest server before the backfill is recorded.
    const moved = Object.entries(layer.operations)
      .filter(([, s]) => s === "moved")
      .map(([op]) => op);
    if (moved.length > 0 && !layer.backfillRecorded)
      add("I2", layer, `moved before the backfill is recorded: ${moved.join(", ")}`);
    // I3 (and I4 for the archive route, which the auditor's group carries): a group flips whole.
    for (const [name, ops, state] of groups)
      if (state === "split") {
        const local = ops.filter((op) => layer.operations[op] === "local");
        add(
          local.some((op) => op.includes("/archive")) ? "I4" : "I3",
          layer,
          `${name} split; still local: ${local.join(", ")}`,
        );
      }
    // I5: no legacy write appears after the first move.
    if (firstMoveIndex !== -1 && index >= firstMoveIndex) {
      const before = new Set(layers[index - 1].writes.map((w) => w.key));
      for (const write of layer.writes)
        if (!before.has(write.key))
          add("I5", layer, `${write.key}: a legacy write added after cutover began`);
    }
    // I6: no coupling beyond the starting commit's.
    const known = new Set(baseline.coupling);
    for (const edge of layer.coupling)
      if (!known.has(edge)) add("I6", layer, `new reach into a sibling module: ${edge}`);
    // I9, I10: once a write group moves, the outside readers are served.
    if (anyGroupMoved && sector.outsideReadTables.length > 0) {
      if (layer.reverseForward.length === 0)
        add("I9", layer, "a write group moved, and no reverse-forward candidate exists");
      else
        add(
          "I9",
          layer,
          `confirm every outside-read table is forwarded back: ${layer.reverseForward.join(", ")}`,
          "needs-human",
        );
      for (const file of layer.outsideReads)
        add("I10", layer, `${file} still reads the legacy tables after the write group moved`);
    }
  });

  // I5 also: at the top of the stack, a moved write group leaves no legacy write behind.
  const top = layers.at(-1);
  if (
    Object.values(sector.groups).every((ops) => groupState(top, ops) === "moved") &&
    top.writes.length > 0
  )
    add(
      "I5",
      top,
      `legacy writes left with every write group moved: ${top.writes.map((w) => w.key).join(", ")}`,
    );
  // I8's code half: what is still served locally at the top.
  const local = Object.entries(top.operations)
    .filter(([, s]) => s === "local")
    .map(([op]) => op);
  add(
    "I8",
    top,
    local.length ? `still local: ${local.join(", ")}` : "nothing local",
    local.length ? "needs-human" : "ok",
  );

  // Each violation counts once, at the first layer it appears in; note whether it was fixed later.
  const firsts = new Map();
  for (const f of findings) {
    const id = `${f.invariant}|${f.detail.replace(/^.*?: /, "")}`;
    if (!firsts.has(id)) firsts.set(id, { ...f, layers: [f.layer] });
    else firsts.get(id).layers.push(f.layer);
  }
  const lastSha = top.sha;
  return [...firsts.values()].map((f) => ({
    ...f,
    fixedLater: f.verdict === "violation" && !f.layers.includes(lastSha),
  }));
};

// --- main ---------------------------------------------------------------------

const layers = stack.map(layerFacts);
const findings = judge(layers);
const report = { sector: sectorName, backfillFrom, stack, layers, findings };
if (out) writeFileSync(out, JSON.stringify(report, null, 2));

for (const layer of layers)
  process.stdout.write(
    `${layer.sha} ${layer.subject.slice(0, 70).padEnd(70)} backfill=${layer.backfillRecorded ? "yes" : "no "} ` +
      `moved=${Object.values(layer.operations).filter((s) => s === "moved").length} writes=${layer.writes.length}\n`,
  );
process.stdout.write("\n");
for (const f of findings)
  process.stdout.write(
    `${f.verdict.padEnd(11)} ${f.invariant.padEnd(4)} ${f.layer} ${f.detail}${f.fixedLater ? "  (fixed later)" : ""}\n`,
  );
const violations = findings.filter((f) => f.verdict === "violation");
process.stdout.write(`\n${violations.length} violation(s)\n`);
