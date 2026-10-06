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

describe.sequential("DELETE /orgs/{orgId}/billing/subscriptions/current (integration)", () => {
  const runtime = useServerTestRuntime(BILLING_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("flips the subscription's status to 'canceled' and returns the canceled view", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedAdminOrganization(database, MEMBER_CALLER_ID, "Acme");
    const params = { path: { orgId } };
    ok(
      (await client.POST("/orgs/{orgId}/billing/subscriptions", { params, body: {} })).data !==
        undefined,
    );
    const res = await client.DELETE("/orgs/{orgId}/billing/subscriptions/current", { params });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data.organizationId, orgId);
    deepStrictEqual(res.data.status, "canceled");
    const current = await client.GET("/orgs/{orgId}/billing/subscriptions/current", { params });
    deepStrictEqual(current.data?.status, "canceled");
  });

  it("returns 404 SubscriptionNotFoundError when canceling a non-existent subscription", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedAdminOrganization(database, MEMBER_CALLER_ID, "Acme");
    const res = await client.DELETE("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "SubscriptionNotFoundError");
  });

  it("returns 403 Forbidden for a caller who isn't an org admin", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedLegacyOrganization(database, "Acme");
    const res = await client.DELETE("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
