import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationAccessFake } from "../infrastructure/acl/organization-access.acl-fake.js";
import { makeIsTodoOrgMember } from "./is-todo-org-member.policy.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };

describe("makeIsTodoOrgMember", () => {
  it("allows a member of the todo's org", async () => {
    const check = makeIsTodoOrgMember(new OrganizationAccessFake(new Set([`${userId}:${orgId}`])));
    deepStrictEqual((await check(caller, { organizationId: orgId })).unwrap(), true);
  });

  it("denies a non-member", async () => {
    const check = makeIsTodoOrgMember(new OrganizationAccessFake());
    deepStrictEqual((await check(caller, { organizationId: orgId })).unwrap(), false);
  });
});
