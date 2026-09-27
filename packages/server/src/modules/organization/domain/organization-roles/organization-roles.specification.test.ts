import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRootOps } from "./organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "./organization-roles.specification.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const issuer = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("OrganizationRolesSpecifications", () => {
  it("hasRole reads the issued roles", () => {
    const empty = OrganizationRolesRootOps.empty(userId, organizationId);
    deepStrictEqual(OrganizationRolesSpecifications.hasRole("admin")(empty), false);
    const admin = OrganizationRolesRootOps.grantRole(empty, "admin", issuer).unwrap()
      .organizationRoles;
    deepStrictEqual(OrganizationRolesSpecifications.hasRole("admin")(admin), true);
    deepStrictEqual(OrganizationRolesSpecifications.forUser(userId)(admin), true);
    deepStrictEqual(OrganizationRolesSpecifications.forOrganization(organizationId)(admin), true);
  });
});
