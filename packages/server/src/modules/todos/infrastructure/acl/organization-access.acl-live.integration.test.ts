import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";
import {
  seedLegacyMembership,
  seedLegacyOrganization,
  seedLegacyUser,
} from "@/test-utils/test-legacy-rows.js";

import { OrganizationAccessLive } from "./organization-access.acl-live.js";

const member = UserId.parse("11111111-1111-1111-1111-111111111111");
const stranger = UserId.parse("22222222-2222-2222-2222-222222222222");

describe.sequential("OrganizationAccessLive over the legacy API's membership rows", () => {
  let db: Database;
  let access: OrganizationAccessLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    access = new OrganizationAccessLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "public.memberships", "public.organizations", "public.users");
    await seedLegacyUser(db, member);
    await seedLegacyUser(db, stranger);
  });

  it("reports a member of the organization and nobody else", async () => {
    const acme = OrganizationId.parse(await seedLegacyOrganization(db, "Acme"));
    const beta = OrganizationId.parse(await seedLegacyOrganization(db, "Beta"));
    await seedLegacyMembership(db, member, acme);
    deepStrictEqual((await access.isMember(member, acme)).unwrap(), true);
    deepStrictEqual((await access.isMember(member, beta)).unwrap(), false);
    deepStrictEqual((await access.isMember(stranger, acme)).unwrap(), false);
  });
});
