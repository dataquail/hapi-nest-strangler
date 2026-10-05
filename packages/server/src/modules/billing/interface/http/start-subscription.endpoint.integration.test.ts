import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { seedAdminOrganization, seedLegacyOrganization } from "@/test-utils/test-legacy-rows.js";

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "public.organization_roles",
  "public.memberships",
  "public.organizations",
  "public.roles",
  "public.users",
] as const;

describe.sequential("POST /orgs/{orgId}/billing/subscriptions (integration)", () => {
  const runtime = useServerTestRuntime(BILLING_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("subscribes an org and returns the created subscription view", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedAdminOrganization(database, MEMBER_CALLER_ID, "Acme");
    const res = await client.POST("/orgs/{orgId}/billing/subscriptions", {
      params: { path: { orgId } },
      body: {},
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.response.status, 201);
    deepStrictEqual(res.data.organizationId, orgId);
    deepStrictEqual(res.data.status, "active");
    ok(res.data.id.length > 0);
  });

  it("returns 409 SubscriptionAlreadyExistsError on a second subscribe for the same org", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedAdminOrganization(database, MEMBER_CALLER_ID, "Acme");
    const params = { path: { orgId } };
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
    const orgId = await seedLegacyOrganization(database, "Acme");
    const res = await client.POST("/orgs/{orgId}/billing/subscriptions", {
      params: { path: { orgId } },
      body: {},
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
