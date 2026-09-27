import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TABLES = [
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
];
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const UNKNOWN_ORG_ID = "99999999-9999-9999-9999-999999999999";
// The seeded member caller doubles as the removal target.
const TARGET_ID = MEMBER_CALLER_ID;

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

const seedTargetMembership = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".memberships (user_id, organization_id, created_at) VALUES (${TARGET_ID}, ${ORG_ID}, now())
  `);

const remove = (orgId: string) => ({ params: { path: { orgId, userId: TARGET_ID } } });

describe.sequential(
  "DELETE /orgs/{orgId}/members/{userId} (integration, super-admin caller)",
  () => {
    const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

    it("removes the target member from the org", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      await seedTargetMembership(database);
      const res = await client.DELETE("/orgs/{orgId}/members/{userId}", remove(ORG_ID));
      deepStrictEqual(res.response.status, 204);
      const after = await client.GET("/orgs/{orgId}/members", {
        params: { path: { orgId: ORG_ID } },
      });
      deepStrictEqual(
        after.data?.members.some((m) => m.userId === TARGET_ID),
        false,
      );
    });

    it("returns 404 when the target is not a member of the org", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      const res = await client.DELETE("/orgs/{orgId}/members/{userId}", remove(ORG_ID));
      deepStrictEqual(res.response.status, 404);
      deepStrictEqual(res.error?._tag, "MembershipNotFoundError");
    });

    it("returns 404 when the organization does not exist", async () => {
      const res = await runtime
        .server()
        .client.DELETE("/orgs/{orgId}/members/{userId}", remove(UNKNOWN_ORG_ID));
      deepStrictEqual(res.response.status, 404);
      deepStrictEqual(res.error?._tag, "OrganizationNotFoundError");
    });
  },
);

describe.sequential(
  "DELETE /orgs/{orgId}/members/{userId} (integration, non-admin member caller)",
  () => {
    const runtime = useServerTestRuntime(TABLES, {
      caller: MEMBER_CALLER,
      seedSuperAdminCaller: true,
    });

    it("forbids a member who is not an org admin from removing members", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      await seedTargetMembership(database);
      const res = await client.DELETE("/orgs/{orgId}/members/{userId}", remove(ORG_ID));
      deepStrictEqual(res.response.status, 403);
      deepStrictEqual(res.error?._tag, "Forbidden");
    });
  },
);
