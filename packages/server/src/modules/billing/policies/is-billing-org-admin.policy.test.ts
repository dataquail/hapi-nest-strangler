import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  accessKey,
  OrganizationAccessFake,
} from "../infrastructure/acl/organization-access.acl-fake.js";
import { makeIsBillingOrgAdmin } from "./is-billing-org-admin.policy.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

describe("makeIsBillingOrgAdmin", () => {
  it("returns true when the caller holds billing authority for the org", async () => {
    const check = makeIsBillingOrgAdmin(
      new OrganizationAccessFake({ admins: new Set([accessKey(userId, orgId)]) }),
    );
    deepStrictEqual((await check(caller, resource)).unwrap(), true);
  });

  it("returns false for a plain member: membership alone is not authority", async () => {
    const check = makeIsBillingOrgAdmin(
      new OrganizationAccessFake({ members: new Set([accessKey(userId, orgId)]) }),
    );
    deepStrictEqual((await check(caller, resource)).unwrap(), false);
  });

  it("asks about the caller and the resource's org, not another org", async () => {
    const other = OrganizationId.parse("33333333-3333-3333-3333-333333333333");
    const check = makeIsBillingOrgAdmin(
      new OrganizationAccessFake({ admins: new Set([accessKey(userId, other)]) }),
    );
    deepStrictEqual((await check(caller, resource)).unwrap(), false);
  });
});
