import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRootOps } from "./organization-roles.root-ops.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const issuer = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("OrganizationRolesRootOps", () => {
  it("grants a role once, recording who issued it", () => {
    const granted = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, organizationId),
      "admin",
      issuer,
    ).unwrap();
    deepStrictEqual(granted.organizationRoles.roles, [{ role: "admin", issuedBy: issuer }]);
    deepStrictEqual(granted.events, [
      { _tag: "OrganizationRoleGranted", userId, organizationId, role: "admin", issuedBy: issuer },
    ]);
    deepStrictEqual(
      OrganizationRolesRootOps.grantRole(granted.organizationRoles, "admin", issuer).unwrapErr()
        ._tag,
      "AlreadyHasOrganizationRole",
    );
  });

  it("revokes a held role and refuses one not held", () => {
    const empty = OrganizationRolesRootOps.empty(userId, organizationId);
    deepStrictEqual(
      OrganizationRolesRootOps.revokeRole(empty, "admin").unwrapErr()._tag,
      "DoesNotHaveOrganizationRole",
    );
    const admin = OrganizationRolesRootOps.grantRole(empty, "admin", issuer).unwrap()
      .organizationRoles;
    const revoked = OrganizationRolesRootOps.revokeRole(admin, "admin").unwrap();
    deepStrictEqual(revoked.organizationRoles.roles, []);
    deepStrictEqual(revoked.events, [
      { _tag: "OrganizationRoleRevoked", userId, organizationId, role: "admin" },
    ]);
  });
});
