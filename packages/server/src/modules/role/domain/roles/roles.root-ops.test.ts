import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { RolesRootOps } from "./roles.root-ops.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");

describe("RolesRootOps.grant", () => {
  it("adds the role and emits RoleGranted", () => {
    const outcome = RolesRootOps.grant(RolesRootOps.empty(alice), "super_admin").unwrap();
    deepStrictEqual(outcome.roles.roles, ["super_admin"]);
    deepStrictEqual(outcome.events, [{ _tag: "RoleGranted", userId: alice, role: "super_admin" }]);
  });

  it("refuses a role already held", () => {
    const admin = RolesRootOps.grant(RolesRootOps.empty(alice), "super_admin").unwrap().roles;
    const result = RolesRootOps.grant(admin, "super_admin");
    deepStrictEqual(result.unwrapErr()._tag, "AlreadyHasRole");
  });
});

describe("RolesRootOps.revoke", () => {
  it("removes the role and emits RoleRevoked", () => {
    const admin = RolesRootOps.grant(RolesRootOps.empty(alice), "super_admin").unwrap().roles;
    const outcome = RolesRootOps.revoke(admin, "super_admin").unwrap();
    deepStrictEqual(outcome.roles.roles, []);
    deepStrictEqual(outcome.events, [{ _tag: "RoleRevoked", userId: alice, role: "super_admin" }]);
  });

  it("refuses a role not held", () => {
    deepStrictEqual(
      RolesRootOps.revoke(RolesRootOps.empty(alice), "super_admin").unwrapErr()._tag,
      "DoesNotHaveRole",
    );
  });

  it("never mutates its input", () => {
    const admin = RolesRootOps.grant(RolesRootOps.empty(alice), "super_admin").unwrap().roles;
    RolesRootOps.revoke(admin, "super_admin");
    deepStrictEqual(admin.roles, ["super_admin"]);
  });
});
