import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  accessKey,
  OrganizationAccessFake,
} from "../infrastructure/acl/organization-access.acl-fake.js";
import { makeIsBillingOrgMember } from "./is-billing-org-member.policy.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

describe("makeIsBillingOrgMember", () => {
  it("returns true for a member of the billing resource's org", async () => {
    const check = makeIsBillingOrgMember(
      new OrganizationAccessFake({ members: new Set([accessKey(userId, orgId)]) }),
    );
    deepStrictEqual((await check(caller, resource)).unwrap(), true);
  });

  it("returns false for a non-member, even an admin-only seed", async () => {
    deepStrictEqual(
      (await makeIsBillingOrgMember(new OrganizationAccessFake())(caller, resource)).unwrap(),
      false,
    );
    const adminOnly = new OrganizationAccessFake({ admins: new Set([accessKey(userId, orgId)]) });
    deepStrictEqual((await makeIsBillingOrgMember(adminOnly)(caller, resource)).unwrap(), false);
  });
});
