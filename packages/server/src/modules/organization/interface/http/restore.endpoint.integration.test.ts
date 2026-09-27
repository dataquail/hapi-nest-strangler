import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";
import { z } from "zod";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TABLES = [
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
];
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const DeletedAtRow = z.object({ deleted_at: z.date().nullable() });

const seedOrg = (db: Database, deleted: boolean) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), ${deleted ? sql.fragment`now()` : sql.fragment`null`})
  `);

const restore = (id: string) => ({ params: { path: { id } } });

describe.sequential("POST /orgs/{id}/restore (integration)", () => {
  // Restore is super-admin-or-org-admin; this suite runs as the super-admin,
  // who cannot create orgs, so the target org is seeded directly.
  const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

  it("clears the tombstone", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database, true);
    const res = await client.POST("/orgs/{id}/restore", restore(ORG_ID));
    deepStrictEqual(res.response.status, 204);
    const rows = await database.any(
      sql.type(
        DeletedAtRow,
      )`SELECT deleted_at FROM "organization".organizations WHERE id = ${ORG_ID}`,
    );
    deepStrictEqual(rows[0]?.deleted_at, null);
  });

  it("returns 409 OrganizationNotDeletedError when restoring an active org", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database, false);
    const res = await client.POST("/orgs/{id}/restore", restore(ORG_ID));
    deepStrictEqual(res.response.status, 409);
    deepStrictEqual(res.error?._tag, "OrganizationNotDeletedError");
  });

  it("returns 404 OrganizationNotFoundError for unknown id", async () => {
    const res = await runtime
      .server()
      .client.POST("/orgs/{id}/restore", restore("00000000-0000-0000-0000-000000000000"));
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "OrganizationNotFoundError");
  });
});

describe.sequential("POST /orgs/{id}/restore (integration, non-super-admin caller)", () => {
  const runtime = useServerTestRuntime(TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  // The policy is any(superAdmin, orgAdmin): the 403 path needs both halves to fail.
  it("returns 403 Forbidden for a caller who is neither a super-admin nor an org admin", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database, true);
    const res = await client.POST("/orgs/{id}/restore", restore(ORG_ID));
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
