import { deepStrictEqual } from "node:assert";
import { readdirSync } from "node:fs";
import * as path from "node:path";

import { describe, it } from "vitest";

import { migrations } from "./migrations/index.js";
import { MODULE_SCHEMAS } from "./migrator.js";

describe("migrations record", () => {
  it("lists every migration file in the directory, in order", () => {
    const onDisk = readdirSync(path.join(import.meta.dirname, "migrations"))
      .filter((name) => /^\d{4}_.*\.ts$/.test(name))
      .map((name) => name.replace(/\.ts$/, ""))
      .sort();
    deepStrictEqual(Object.keys(migrations), onDisk);
  });

  it("creates every module schema before any table", () => {
    const names = Object.keys(migrations);
    const lastSchema = Math.max(...names.map((n, i) => (n.includes("create_schema") ? i : -1)));
    const firstTable = names.findIndex((n) => n.includes("create_table"));
    const schemasCreated = names
      .filter((n) => n.includes("create_schema"))
      .map((n) => n.replace(/^\d{4}_create_schema_/, ""));
    deepStrictEqual(new Set(schemasCreated), new Set(MODULE_SCHEMAS));
    deepStrictEqual(lastSchema < firstTable || names[lastSchema]?.includes("billing"), true);
  });
});
