import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { DatabaseUnavailable, translateDatabaseError } from "./errors.js";

describe("translateDatabaseError", () => {
  it("reads a transient code off the error or down its cause chain", () => {
    const direct = translateDatabaseError({ code: "ECONNREFUSED" });
    ok(direct instanceof DatabaseUnavailable);
    deepStrictEqual(direct.message, "[object Object]");

    const nested = translateDatabaseError(new Error("pool gone", { cause: { code: "57P01" } }));
    ok(nested instanceof DatabaseUnavailable);
    deepStrictEqual(nested.message, "pool gone");
  });

  it("leaves anything without a transient code untouched", () => {
    deepStrictEqual(translateDatabaseError("boom"), "boom");
    const numericCode = { code: 42 };
    deepStrictEqual(translateDatabaseError(numericCode), numericCode);
    const syntax = { code: "42601" };
    deepStrictEqual(translateDatabaseError(syntax), syntax);
  });

  it("passes an already translated error through", () => {
    const unavailable = new DatabaseUnavailable({ cause: null, message: "down" });
    deepStrictEqual(translateDatabaseError(unavailable), unavailable);
  });
});
