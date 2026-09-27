import { deepStrictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import * as path from "node:path";

import { describe, it } from "vitest";

import { buildOpenApiDocument } from "./document.js";

const committed = (): unknown =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "openapi.json"), "utf8"));

describe("openapi.json", () => {
  it("is what the contracts generate (run `pnpm -F @org/contracts generate` when this fails)", () => {
    deepStrictEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())), committed());
  });

  it("registers every route of every group exactly once", () => {
    const document = buildOpenApiDocument();
    const operationIds = Object.values(document.paths ?? {}).flatMap((methods) =>
      Object.values(methods as Record<string, { operationId?: string }>).map(
        (operation) => operation.operationId,
      ),
    );
    deepStrictEqual(new Set(operationIds).size, operationIds.length);
    deepStrictEqual(operationIds.includes("todos.create"), true);
    deepStrictEqual(operationIds.includes("cliAuth.deviceToken"), true);
  });
});
