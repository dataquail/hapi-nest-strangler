import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { SessionId } from "./session.id.js";
import { SessionSpecifications } from "./session.specification.js";

const id = SessionId.parse("11111111-1111-1111-1111-111111111111");

describe("SessionSpecifications", () => {
  it("withId carries an Eq criteria on id", () => {
    deepStrictEqual(SessionSpecifications.withId(id).criteria, {
      _tag: "Eq",
      field: "id",
      value: id,
    });
  });
});
