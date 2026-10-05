import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  accessKey,
  OrganizationAccessFake,
} from "../infrastructure/acl/organization-access.acl-fake.js";
import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { BillingPolicyContribution } from "./billing.policies.js";

const member = UserId.parse("11111111-1111-1111-1111-111111111111");
const admin = UserId.parse("22222222-2222-2222-2222-222222222222");
const superAdmin = UserId.parse("33333333-3333-3333-3333-333333333333");
const stranger = UserId.parse("44444444-4444-4444-4444-444444444444");
const orgId = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const policies = new BillingPolicyContribution(
  new PlatformRolesFake(new Set([superAdmin])),
  new OrganizationAccessFake({
    members: new Set([accessKey(member, orgId), accessKey(admin, orgId)]),
    admins: new Set([accessKey(admin, orgId)]),
  }),
).contribution;

const read = policies.billing?.read;
const update = policies.billing?.update;
if (typeof read !== "function" || typeof update !== "function")
  throw new Error("billing policies not registered");

const as = (userId: UserId) => ({ sessionId: "s", userId });
const resource = { organizationId: orgId };

describe("billing policies", () => {
  it("read: member, admin and super admin allowed; stranger denied", async () => {
    deepStrictEqual((await read(as(member), resource)).unwrap(), true);
    deepStrictEqual((await read(as(admin), resource)).unwrap(), true);
    deepStrictEqual((await read(as(superAdmin), resource)).unwrap(), true);
    deepStrictEqual((await read(as(stranger), resource)).unwrap(), false);
  });

  it("update: admin and super admin allowed; plain member and stranger denied", async () => {
    deepStrictEqual((await update(as(admin), resource)).unwrap(), true);
    deepStrictEqual((await update(as(superAdmin), resource)).unwrap(), true);
    deepStrictEqual((await update(as(member), resource)).unwrap(), false);
    deepStrictEqual((await update(as(stranger), resource)).unwrap(), false);
  });
});
