import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { RolesRoot } from "./roles.root.js";
import { RolesSpecifications } from "./roles.specification.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");
const bob = UserId.parse("22222222-2222-2222-2222-222222222222");
const admin = RolesRoot.parse({ userId: alice, roles: ["super_admin"] });

describe("RolesSpecifications", () => {
  it("forUser matches the aggregate of that user and carries an Eq criteria", () => {
    deepStrictEqual(RolesSpecifications.forUser(alice)(admin), true);
    deepStrictEqual(RolesSpecifications.forUser(bob)(admin), false);
    deepStrictEqual(RolesSpecifications.forUser(alice).criteria, {
      _tag: "Eq",
      field: "userId",
      value: alice,
    });
  });

  it("hasRole reads the role list", () => {
    deepStrictEqual(RolesSpecifications.hasRole("super_admin")(admin), true);
    deepStrictEqual(
      RolesSpecifications.hasRole("super_admin")(RolesRoot.parse({ userId: bob, roles: [] })),
      false,
    );
  });
});
