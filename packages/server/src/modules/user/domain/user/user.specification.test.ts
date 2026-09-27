import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { UserRootOps } from "./user.root-ops.js";
import { UserSpecifications } from "./user.specification.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2025-01-01T00:00:00Z");
const { user } = UserRootOps.create({ id: alice, email: "alice@example.com", address: null, now });

describe("UserSpecifications", () => {
  it("withId and withEmail match the user and carry Eq criteria", () => {
    deepStrictEqual(UserSpecifications.withId(alice)(user), true);
    deepStrictEqual(UserSpecifications.withEmail("alice@example.com")(user), true);
    deepStrictEqual(UserSpecifications.withEmail("bob@example.com")(user), false);
    deepStrictEqual(UserSpecifications.withEmail("x").criteria, {
      _tag: "Eq",
      field: "email",
      value: "x",
    });
  });
});
