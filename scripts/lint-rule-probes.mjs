#!/usr/bin/env node
// The architectural rules (ADR-0008 taxonomy, ADR-0020 data boundaries, and the
// local rules) run through oxlint's JS plugin system, which is alpha. The
// failure mode that matters is not a crash but a rule going silently vacuous —
// still configured, still "passing", enforcing nothing. A clean lint run cannot
// distinguish that from a clean codebase.
//
// So each rule gets a probe: a file that violates it, written to the path its
// globs actually match, linted, and asserted on. A rule that stops firing fails
// this script loudly instead of quietly disarming an ADR.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

// Probe filenames must not start with an underscore. The folder-structure
// plugin mangles a leading `_` when substituting `{node-name}`, so an
// `enforceExistence` rule fires on such a file whether or not its sibling
// exists — a parity probe named that way passes vacuously, which is the exact
// failure mode this script exists to catch.
/** @type {Array<{rule: string, file: string, source: string}>} */
const PROBES = [
  {
    rule: "architecture/structure",
    file: "packages/server/src/modules/wallet/zzprobe-stray.ts",
    source: "export const probe = 1;\n",
  },
  {
    rule: "architecture/structure",
    file: "packages/web/features/zzprobe-untiered.tsx",
    source: "export const Probe = () => null;\n",
  },
  {
    // Naming: the stereotype suffix is right, the concept name in front of it
    // is not. Without this the layout rule admits the file and nothing else
    // looks at the name.
    rule: "architecture/structure",
    file: "packages/server/src/modules/wallet/commands/zzProbeStray.handler.ts",
    source: "export const probe = 1;\n",
  },
  {
    // Named after its folder: the right shape, the wrong aggregate.
    rule: "architecture/structure",
    file: "packages/server/src/modules/wallet/domain/wallet/zzprobe-stray.root.ts",
    source: "export const probe = 1;\n",
  },
  {
    // A bus factory outside a composition root: the exports family, which
    // reads the imported name rather than the path.
    rule: "architecture/exports",
    file: "packages/server/src/modules/wallet/commands/zzprobe-bus.handler.ts",
    source:
      'import { makeEventBus } from "@org/event-bus";\n\nexport const probe = makeEventBus;\n',
  },
  {
    // Nest's own event bus. There is one bus in this repo, and it is not this one.
    rule: "architecture/exports",
    file: "packages/server/src/modules/wallet/commands/zzprobe-nest-bus.handler.ts",
    source: 'import { EventBus } from "@nestjs/cqrs";\n\nexport const probe = EventBus;\n',
  },
  {
    // A namespace binding of a fenced library: the plugin sees `import *
    // as`, `export *`, `import()` and `require()` as the one `*` binding.
    rule: "architecture/exports",
    file: "packages/server/src/modules/wallet/commands/zzprobe-ns.handler.ts",
    source: 'import * as Cqrs from "@nestjs/cqrs";\n\nexport const probe = Cqrs;\n',
  },
  {
    // The authz registries built outside platform/.
    rule: "architecture/exports",
    file: "packages/server/src/modules/wallet/policies/zzprobe-registry.policy.ts",
    source:
      'import { makePolicyRegistry } from "@org/authz";\n\nexport const probe = makePolicyRegistry;\n',
  },
  {
    // The surface family: what a file may export. A default export where the
    // manifest admits none, and a star re-export where it admits none.
    rule: "architecture/surface",
    file: "packages/server/src/zzprobe-default.ts",
    source: "const probe = 1;\nexport default probe;\n",
  },
  {
    rule: "architecture/surface",
    file: "packages/server/src/modules/wallet/commands/zzprobe-star.command.ts",
    source: 'export * from "@/modules/wallet/commands/create-wallet.command.js";\n',
  },
  {
    // A handler file with two handler classes in it — the count demand, which
    // is a statement about the file's whole surface rather than any one site.
    rule: "architecture/surface",
    file: "packages/server/src/modules/wallet/commands/zzprobe-two.handler.ts",
    source: "export class ZzProbeOneHandler {}\nexport class ZzProbeTwoHandler {}\n",
  },
  {
    rule: "local/no-array-push-spread",
    file: "packages/server/src/zzprobe-push.ts",
    source:
      "const items: Array<number> = [];\nconst target: Array<number> = [];\ntarget.push(...items);\n\nexport const probe = target;\n",
  },
  {
    rule: "local/lucide-icon-suffix",
    file: "packages/components/primitives/zzprobe-lucide.ts",
    source: 'import { Clock } from "lucide-react";\n\nexport const probe = Clock;\n',
  },
  {
    rule: "local/no-inline-styling",
    file: "packages/web/features/zzprobe/probe-styling.view.tsx",
    source: 'export const Probe = () => <Probe className="p-4" />;\n',
  },
  {
    // State in a View: a hook in `use*` position that is not the View's own
    // ViewModel hook.
    rule: "architecture/members",
    file: "packages/web/features/zzprobe/probe-hooks.view.tsx",
    source:
      'import * as React from "react";\n\nexport const Probe = () => {\n  const [n] = React.useState(0);\n  return n;\n};\n',
  },
  {
    rule: "react/forbid-elements",
    file: "packages/web/features/zzprobe/probe-intrinsic.view.tsx",
    source: "export const Probe = () => <div />;\n",
  },
  {
    // A real violation in the shape production code actually takes: slonik's
    // typed tag reading another module's schema, with the quotes ADR-0020
    // requires on a reserved word.
    rule: "local/no-cross-schema-sql-access",
    file: "packages/server/src/modules/wallet/queries/zzprobe-cross-schema.handler.ts",
    source:
      'import { RowSchemas, sql } from "@org/database";\n\n' +
      'export const probe = sql.type(RowSchemas.WalletRow)`SELECT id FROM "user".users`;\n',
  },
  {
    // The other half of the rule, in the other spelling of the tag: a table
    // with no schema at all, under `sql.unsafe`.
    rule: "local/no-cross-schema-sql-access",
    file: "packages/server/src/modules/wallet/queries/zzprobe-unqualified.handler.ts",
    source:
      'import { sql } from "@org/database";\n\nexport const probe = sql.unsafe`SELECT id FROM wallets`;\n',
  },
  {
    // The alias root differs per package (server: src/, web: package root), so
    // each aliased package is probed separately — a package missing from the
    // rule's map makes it silently vacuous there.
    rule: "local/no-deep-relative-imports",
    file: "packages/server/src/zzprobe/deep/probe.ts",
    source: 'import { probe as p } from "../../platform/ids";\n\nexport const probe = p;\n',
  },
  {
    rule: "local/no-deep-relative-imports",
    file: "packages/web/features/zzprobe/deep/probe.view.tsx",
    source:
      'import { probe as p } from "../../../services/format/probe";\n\nexport const Probe = () => p;\n',
  },
  {
    rule: "local/no-relative-import-outside-package",
    file: "packages/server/src/zzprobe-outside-pkg.ts",
    source:
      'import { probe as p } from "../../contracts/src/index.js";\n\nexport const probe = p;\n',
  },
  {
    rule: "architecture/members",
    file: "packages/server/src/modules/wallet/domain/wallet/zzprobe-dumb.repository.ts",
    source:
      "export type ProbeRepositoryShape = {\n  readonly findOneById: (id: string) => string;\n};\n",
  },
  {
    rule: "local/enforce-react-namespace",
    file: "packages/components/primitives/zzprobe-react-ns.tsx",
    source: 'import { useState } from "react";\n\nexport const probe = useState;\n',
  },
  {
    rule: "architecture/structure",
    file: "packages/components/primitives/zzprobe/probe.tsx",
    source: "export const Probe = () => null;\n",
  },
  {
    rule: "architecture/structure",
    file: "packages/components/patterns/zzprobe/probe.tsx",
    source: "export const Probe = () => null;\n",
  },
  {
    // The parity half of the taxonomy. These three cover its distinct
    // mechanisms: the cross-folder port trio, a same-folder {node-name}.test.ts,
    // and the {node-name}.integration.test.ts variant.
    rule: "architecture/structure",
    file: "packages/server/src/modules/wallet/domain/wallet/zzprobe-parity.repository.ts",
    source:
      "export type ProbeRepositoryShape = {\n  readonly findOne: (spec: unknown) => unknown;\n};\n",
  },
  {
    rule: "architecture/structure",
    file: "packages/server/src/modules/wallet/commands/zzprobe-parity.handler.ts",
    source: "export class ZzProbeParityHandler {}\n",
  },
  {
    rule: "architecture/structure",
    file: "packages/server/src/modules/wallet/interface/http/zzprobe-parity.endpoint.ts",
    source: "export class ZzProbeParityEndpoint {}\n",
  },
  {
    rule: "architecture/structure",
    file: "packages/web/features/zzprobe/probe.view-model.ts",
    source: "export const useProbeViewModel = () => null;\n",
  },
  {
    // The architecture plugin's own per-rule coverage lives in
    // `architecture.yaml` — every rule carries a `probe` the plugin
    // refuses to load without. What these prove is the WIRING: that the
    // plugin is loaded, its rule is enabled, its globs match, and resolution is
    // live rather than quietly failing open.
    rule: "architecture/imports",
    file: "packages/server/src/modules/wallet/commands/zzprobe-arch.handler.ts",
    source:
      'import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/repositories/wallet.repository-live.js";\n\nexport const probe = WalletRepositoryLive;\n',
  },
  {
    // A policy naming the authz library instead of the platform file that
    // carries its augmentation.
    rule: "architecture/imports",
    file: "packages/server/src/modules/wallet/policies/zzprobe-direct.policy.ts",
    source: 'import { Check } from "@org/authz";\n\nexport const probe = Check;\n',
  },
  {
    // An import nobody can resolve is an import no rule can police, so the
    // resolver failing open would disarm every rule at once without changing a
    // single line of config.
    rule: "architecture/imports",
    file: "packages/server/src/zzprobe-unresolved.ts",
    source: 'import { probe } from "@org/definitely-not-a-real-package";\n\nexport { probe };\n',
  },
  {
    // The campaigns family: a hapi module reaching into a sibling module is a
    // holdout of the strangler campaign, and one the ledger does not carry is
    // reported in the editor.
    rule: "architecture/campaigns",
    file: "packages/legacy-api/src/application/todo/zzprobe-reach.ts",
    source:
      'import type UserService = require("../user/user-service");\n\nexport const probe: UserService | null = null;\n',
  },
  {
    // Circularity is the one dependency-cruiser rule with no per-file
    // equivalent; oxlint's own rule replaced it, so it needs the same proof.
    rule: "import/no-cycle",
    file: "packages/server/src/zzprobe-cycle-a.ts",
    source: 'import { b } from "./zzprobe-cycle-b.js";\n\nexport const a = () => b;\n',
  },
  {
    rule: "import/no-cycle",
    file: "packages/server/src/zzprobe-cycle-b.ts",
    source: 'import { a } from "./zzprobe-cycle-a.js";\n\nexport const b = () => a;\n',
  },
];

// Every folder of a probe path that did not already exist.
const foldersOf = (file) => {
  const folders = [];
  const segments = path.dirname(file).split("/");
  for (let depth = segments.length; depth > 0; depth -= 1) {
    const folder = segments.slice(0, depth).join("/");
    if (existsSync(path.join(repoRoot, folder))) break;
    folders.push(folder);
  }
  return folders;
};

const written = [];
// Folders the probes created. Removed after the files, deepest first — an empty
// stray folder is invisible to git and to the taxonomy rule, so left behind it
// accumulates silently.
const createdFolders = new Set();
const cleanup = () => {
  for (const file of written.toReversed()) {
    rmSync(path.join(repoRoot, file), { force: true });
  }
  for (const folder of [...createdFolders].sort((a, b) => b.length - a.length)) {
    // Recursive is safe and deliberate: these are folders that did not exist
    // before this run, so everything in them is the run's own.
    rmSync(path.join(repoRoot, folder), { force: true, recursive: true });
  }
};

process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

for (const probe of PROBES) {
  const absolute = path.join(repoRoot, probe.file);
  for (const folder of foldersOf(probe.file)) createdFolders.add(folder);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, probe.source);
  written.push(probe.file);
}

let output = "";
try {
  output = execFileSync("npx", ["oxlint", "--format=json", ...PROBES.map((p) => p.file)], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  // oxlint exits non-zero because the probes are violations. That is the point.
  output = typeof error.stdout === "string" ? error.stdout : "";
}

const diagnostics = (JSON.parse(output || '{"diagnostics":[]}').diagnostics ?? []).map((d) => ({
  rule: (d.code ?? "").replace(/^(.+?)\((.+)\)$/, "$1/$2"),
  file: (d.filename ?? d.labels?.[0]?.filename ?? "").replace(/^\.\//, ""),
}));

const results = PROBES.map((probe) => ({
  rule: probe.rule,
  fired: diagnostics.some((d) => d.rule === probe.rule && d.file === probe.file),
}));

const width = Math.max(...results.map((r) => r.rule.length));
for (const { fired, rule } of results) {
  process.stdout.write(
    `  ${fired ? "✓" : "✗"}  ${rule.padEnd(width)}  ${fired ? "fires" : "SILENT — rule is vacuous"}\n`,
  );
}

const silent = results.filter((r) => !r.fired);
if (silent.length > 0) {
  process.stderr.write(
    `\n${silent.length} of ${results.length} architectural rules did not fire on a known violation.\n` +
      "A configured rule that reports nothing enforces nothing. Fix the rule or its config.\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`\nAll ${results.length} architectural rules fire on a known violation.\n`);
}
