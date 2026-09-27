import { deepStrictEqual, ok } from "node:assert";

import { sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describe.sequential("GET /orgs/{orgId}/billing/subscriptions/current (integration)", () => {
  const runtime = useServerTestRuntime(BILLING_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("returns the subscription view after subscribing", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined);
    const params = { path: { orgId: org.data.id } };
    ok(
      (await client.POST("/orgs/{orgId}/billing/subscriptions", { params, body: {} })).data !==
        undefined,
    );
    const res = await client.GET("/orgs/{orgId}/billing/subscriptions/current", { params });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data.organizationId, org.data.id);
    deepStrictEqual(res.data.status, "active");
  });

  it("returns 404 SubscriptionNotFoundError when no subscription exists for the org", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined);
    const res = await client.GET("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId: org.data.id } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "SubscriptionNotFoundError");
  });

  it("returns 403 Forbidden for a caller who isn't a member of the org", async () => {
    const { client, database } = runtime.server();
    const orgId = "11111111-1111-1111-1111-111111111111";
    await database.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES (${orgId}, 'Acme', now(), now(), null)
    `);
    const res = await client.GET("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
