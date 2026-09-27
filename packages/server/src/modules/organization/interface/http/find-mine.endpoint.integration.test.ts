import { deepStrictEqual, ok } from "node:assert";

import { sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

describe.sequential("GET /orgs (integration, findMine)", () => {
  // The caller must be able to own orgs: a regular member, not a super-admin.
  const runtime = useServerTestRuntime(
    [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    { caller: MEMBER_CALLER, seedSuperAdminCaller: true },
  );

  const createOrg = async (name: string): Promise<string> => {
    const res = await runtime.server().client.POST("/orgs", { body: { name } });
    ok(res.data !== undefined, JSON.stringify(res.error));
    return res.data.id;
  };

  it("returns the caller's organizations, most-recently-created first", async () => {
    await createOrg("Acme");
    await createOrg("Beta");
    const res = await runtime.server().client.GET("/orgs");
    deepStrictEqual(
      res.data?.map((o) => o.name),
      ["Beta", "Acme"],
    );
    // The creator is auto-granted the admin role.
    deepStrictEqual(
      res.data?.map((o) => o.isAdmin),
      [true, true],
    );
  });

  it("returns empty when the caller has no memberships", async () => {
    const res = await runtime.server().client.GET("/orgs");
    deepStrictEqual(res.data, []);
  });

  it("hides soft-deleted orgs", async () => {
    await createOrg("Acme");
    const betaId = await createOrg("Beta");
    // Soft-delete is super-admin-only, so the tombstone is set directly.
    await runtime.server().database.exec(sql.unsafe`
      UPDATE "organization".organizations SET deleted_at = now() WHERE id = ${betaId}
    `);
    const res = await runtime.server().client.GET("/orgs");
    deepStrictEqual(
      res.data?.map((o) => o.name),
      ["Acme"],
    );
  });
});
