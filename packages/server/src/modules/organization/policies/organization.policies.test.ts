import { deepStrictEqual } from "node:assert";

import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { OrganizationPolicyContribution } from "./organization.policies.js";

const member = UserId.parse("11111111-1111-1111-1111-111111111111");
const admin = UserId.parse("22222222-2222-2222-2222-222222222222");
const superAdmin = UserId.parse("33333333-3333-3333-3333-333333333333");
const organizationId = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const queries = {
  execute: (query: { constructor: { name: string }; payload: { userId: UserId } }) => {
    if (query.constructor.name === "FindMembershipQuery") {
      return Promise.resolve(
        Ok({ isMember: query.payload.userId === member || query.payload.userId === admin }),
      );
    }
    return Promise.resolve(
      Ok({
        userId: query.payload.userId,
        organizationId,
        roles: query.payload.userId === admin ? ["admin"] : [],
      }),
    );
  },
} as unknown as AppQueryBus;

const policies = new OrganizationPolicyContribution(
  new PlatformRolesFake(new Set([superAdmin])),
  queries,
).contribution;
const check = (action: "read" | "update" | "delete") => {
  const found = policies.organization?.[action];
  if (typeof found !== "function") throw new Error(`organization.${action} not registered`);
  return found;
};
const as = (userId: UserId) => ({ sessionId: "s", userId });

describe("organization policies", () => {
  it("read: members and super admins; update: admins and super admins; delete: super admins only", async () => {
    deepStrictEqual((await check("read")(as(member), { organizationId })).unwrap(), true);
    deepStrictEqual((await check("update")(as(member), { organizationId })).unwrap(), false);
    deepStrictEqual((await check("update")(as(admin), { organizationId })).unwrap(), true);
    deepStrictEqual((await check("delete")(as(admin), { organizationId })).unwrap(), false);
    deepStrictEqual((await check("delete")(as(superAdmin), { organizationId })).unwrap(), true);
  });
});
