import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { TaggedError } from "./tagged-error.js";

class ThingMissing extends TaggedError("ThingMissing")<{ readonly thingId: string }> {}
class Bare extends TaggedError("Bare") {}

describe("TaggedError", () => {
  it("stamps the tag and exposes the props as readonly fields", () => {
    const error = new ThingMissing({ thingId: "t-1" });
    deepStrictEqual(error._tag, "ThingMissing");
    deepStrictEqual(error.thingId, "t-1");
    deepStrictEqual(error instanceof ThingMissing, true);
  });

  it("supports errors with no props", () => {
    deepStrictEqual(new Bare({})._tag, "Bare");
  });
});
