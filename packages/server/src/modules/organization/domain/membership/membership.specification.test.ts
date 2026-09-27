import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipRootOps } from "./membership.root-ops.js";
import { MembershipSpecifications } from "./membership.specification.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const otherOrg = OrganizationId.parse("33333333-3333-3333-3333-333333333333");
const { membership } = MembershipRootOps.create({ userId, organizationId: orgId, now: new Date() });

describe("MembershipSpecifications", () => {
  it("compose forUser and forOrganization", () => {
    const spec = Spec.and(
      MembershipSpecifications.forUser(userId),
      MembershipSpecifications.forOrganization(orgId),
    );
    deepStrictEqual(spec(membership), true);
    deepStrictEqual(
      Spec.and(
        MembershipSpecifications.forUser(userId),
        MembershipSpecifications.forOrganization(otherOrg),
      )(membership),
      false,
    );
  });
});
