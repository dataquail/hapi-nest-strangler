import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipRootOps } from "./membership.root-ops.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");

describe("MembershipRootOps", () => {
  it("create emits MembershipCreated", () => {
    const { events, membership } = MembershipRootOps.create({ userId, organizationId, now });
    deepStrictEqual(membership, { userId, organizationId, createdAt: now });
    deepStrictEqual(events, [{ _tag: "MembershipCreated", userId, organizationId }]);
  });

  it("revoke emits MembershipRevoked", () => {
    const { membership } = MembershipRootOps.create({ userId, organizationId, now });
    deepStrictEqual(MembershipRootOps.revoke(membership).events, [
      { _tag: "MembershipRevoked", userId, organizationId },
    ]);
  });
});
