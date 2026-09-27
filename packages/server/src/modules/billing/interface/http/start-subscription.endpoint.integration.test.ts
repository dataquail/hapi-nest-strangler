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

// Creating the org through the endpoint makes the caller its admin, which is
// the `update` gate subscribing needs.
describe.sequential("POST /orgs/{orgId}/billing/subscriptions (integration)", () => {
  const runtime = useServerTestRuntime(BILLING_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("subscribes an org and returns the created subscription view", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    const res = await client.POST("/orgs/{orgId}/billing/subscriptions", {
      params: { path: { orgId: org.data.id } },
      body: {},
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.response.status, 201);
    deepStrictEqual(res.data.organizationId, org.data.id);
    deepStrictEqual(res.data.status, "active");
    ok(res.data.id.length > 0);
  });

  it("returns 409 SubscriptionAlreadyExistsError on a second subscribe for the same org", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined);
    const params = { path: { orgId: org.data.id } };
    ok(
      (await client.POST("/orgs/{orgId}/billing/subscriptions", { params, body: {} })).data !==
        undefined,
    );
    const second = await client.POST("/orgs/{orgId}/billing/subscriptions", { params, body: {} });
    deepStrictEqual(second.response.status, 409);
    deepStrictEqual(second.error?._tag, "SubscriptionAlreadyExistsError");
  });

  it("returns 403 Forbidden for a caller who isn't an org admin", async () => {
    const { client, database } = runtime.server();
    const orgId = "11111111-1111-1111-1111-111111111111";
    await database.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES (${orgId}, 'Acme', now(), now(), null)
    `);
    const res = await client.POST("/orgs/{orgId}/billing/subscriptions", {
      params: { path: { orgId } },
      body: {},
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
