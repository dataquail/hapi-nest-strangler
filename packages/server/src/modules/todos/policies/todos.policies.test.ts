import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationAccessFake } from "../infrastructure/acl/organization-access.acl-fake.js";
import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { TodoPolicyContribution } from "./todos.policies.js";

const member = UserId.parse("11111111-1111-1111-1111-111111111111");
const admin = UserId.parse("22222222-2222-2222-2222-222222222222");
const stranger = UserId.parse("33333333-3333-3333-3333-333333333333");
const orgId = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const policies = new TodoPolicyContribution(
  new PlatformRolesFake(new Set([admin])),
  new OrganizationAccessFake(new Set([`${member}:${orgId}`])),
).contribution;

const check = policies.todoCollection?.create;
if (typeof check !== "function") throw new Error("todoCollection.create not registered");

describe("todo policies", () => {
  it("allow a member and a super admin, deny a stranger", async () => {
    deepStrictEqual(
      (await check({ sessionId: "s", userId: member }, { organizationId: orgId })).unwrap(),
      true,
    );
    deepStrictEqual(
      (await check({ sessionId: "s", userId: admin }, { organizationId: orgId })).unwrap(),
      true,
    );
    deepStrictEqual(
      (await check({ sessionId: "s", userId: stranger }, { organizationId: orgId })).unwrap(),
      false,
    );
  });
});
