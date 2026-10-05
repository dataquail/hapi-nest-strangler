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

  // Schemas arrive one module at a time as the strangler moves them, so the
  // order that holds is per module: its schema before any of its tables.
  it("creates each module's schema before that module's tables", () => {
    const names = Object.keys(migrations);
    const schemaIndex = new Map(
      names.flatMap((name, index) => {
        const schema = /^\d{4}_create_schema_(.+)$/.exec(name)?.[1];
        return schema === undefined ? [] : [[schema, index] as const];
      }),
    );
    deepStrictEqual(new Set(schemaIndex.keys()), new Set(MODULE_SCHEMAS));
    for (const [index, name] of names.entries()) {
      const table = /^\d{4}_create_table_([a-z]+)_/.exec(name);
      if (table === null) continue;
      const schema = table[1];
      const created = schemaIndex.get(schema ?? "");
      deepStrictEqual(created !== undefined && created < index, true, name);
    }
  });
});
