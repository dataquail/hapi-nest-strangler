import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import {
  seedAdminOrganization,
  seedLegacyOrganization,
  seedMemberOrganization,
} from "@/test-utils/test-legacy-rows.js";

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "public.organization_roles",
  "public.memberships",
  "public.organizations",
  "public.roles",
  "public.users",
] as const;

describe.sequential("GET /orgs/{orgId}/billing/subscriptions/current (integration)", () => {
  const runtime = useServerTestRuntime(BILLING_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("returns the organization's subscription to a member", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedAdminOrganization(database, MEMBER_CALLER_ID, "Acme");
    const started = await client.POST("/orgs/{orgId}/billing/subscriptions", {
      params: { path: { orgId } },
      body: {},
    });
    ok(started.data !== undefined, JSON.stringify(started.error));

    const res = await client.GET("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data, started.data);
  });

  it("returns 404 SubscriptionNotFoundError when the organization has none", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedMemberOrganization(database, MEMBER_CALLER_ID, "Acme");
    const res = await client.GET("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "SubscriptionNotFoundError");
  });

  it("returns 403 Forbidden for a caller who isn't a member of the org", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedLegacyOrganization(database, "Acme");
    const res = await client.GET("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
