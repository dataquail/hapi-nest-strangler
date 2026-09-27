import { describe, expect, it } from "vitest";
import { z } from "zod";

import { validateWithSchema } from "./form-validation";

const Signup = z.object({ email: z.string().min(3), age: z.string() });

describe("validateWithSchema", () => {
  it("returns null when the input satisfies the schema", () => {
    expect(validateWithSchema(Signup)({ email: "ada@example.com", age: "36" })).toBeNull();
  });

  it("maps each issue onto its field", () => {
    expect(Object.keys(validateWithSchema(Signup)({ email: "a", age: "36" }) ?? {})).toEqual([
      "email",
    ]);
  });

  it("reports every failing field, not just the first", () => {
    const errors = validateWithSchema(Signup)({ email: "a", age: 36 as unknown as string });
    expect(Object.keys(errors ?? {}).sort()).toEqual(["age", "email"]);
  });
});
