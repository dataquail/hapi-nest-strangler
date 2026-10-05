import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";
import { seedLegacySuperAdmin, seedLegacyUser } from "@/test-utils/test-legacy-rows.js";

import { PlatformRolesLive } from "./platform-roles.acl-live.js";

const admin = UserId.parse("11111111-1111-1111-1111-111111111111");
const member = UserId.parse("22222222-2222-2222-2222-222222222222");

describe.sequential("PlatformRolesLive over the legacy API's role rows", () => {
  let db: Database;
  let roles: PlatformRolesLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    roles = new PlatformRolesLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "public.roles", "public.users");
    await seedLegacyUser(db, admin);
    await seedLegacyUser(db, member);
  });

  it("reports the super_admin grant and nothing less", async () => {
    await seedLegacySuperAdmin(db, admin);
    deepStrictEqual((await roles.isSuperAdmin(admin)).unwrap(), true);
    deepStrictEqual((await roles.isSuperAdmin(member)).unwrap(), false);
  });
});
