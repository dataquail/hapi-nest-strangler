import { deepStrictEqual, ok } from "node:assert";

import { sql } from "@org/database";
import { describe, it } from "vitest";

import { FAKE_WEBHOOK_SIGNATURE } from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake.js";
import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import type { TestServer } from "@/test-utils/test-server.js";

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

// The fake gateway's counter persists across tests within one server, so the
// Stripe id is read back from the row rather than hardcoded.
const subscribe = async (server: TestServer) => {
  const org = await server.client.POST("/orgs", { body: { name: "Acme" } });
  ok(org.data !== undefined);
  const params = { path: { orgId: org.data.id } };
  const sub = await server.client.POST("/orgs/{orgId}/billing/subscriptions", { params, body: {} });
  ok(sub.data !== undefined, JSON.stringify(sub.error));
  const row = await server.database.one(
    sql.unsafe`SELECT stripe_subscription_id FROM billing.subscriptions WHERE organization_id = ${org.data.id}`,
  );
  const stripeSubId = (row as { stripe_subscription_id: string }).stripe_subscription_id;
  const current = () =>
    server.client.GET("/orgs/{orgId}/billing/subscriptions/current", { params });
  return { subscriptionId: sub.data.id, stripeSubId, current };
};

// The raw body is what the signature covers, so the request is sent with
// fetch rather than the typed client's JSON serialisation.
const deliver = (server: TestServer, body: string, signature = FAKE_WEBHOOK_SIGNATURE) =>
  fetch(`${server.baseUrl}/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body,
  });

const subscriptionUpdated = (eventId: string, stripeSubId: string, status: string) =>
  JSON.stringify({
    eventId,
    type: "customer.subscription.updated",
    subscription: { stripeSubscriptionId: stripeSubId, status, currentPeriodEnd: null },
  });

describe.sequential("POST /webhooks/stripe (integration)", () => {
  const runtime = useServerTestRuntime(BILLING_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("flips an existing subscription's status when delivered an updated event", async () => {
    const server = runtime.server();
    const { current, stripeSubId, subscriptionId } = await subscribe(server);
    const res = await deliver(
      server,
      subscriptionUpdated("evt_test_webhook_1", stripeSubId, "past_due"),
    );
    deepStrictEqual(res.status, 204);
    const after = await current();
    deepStrictEqual(after.data?.status, "past_due");
    deepStrictEqual(after.data?.id, subscriptionId);
  });

  it("returns 401 on a bad signature without dispatching commands", async () => {
    const server = runtime.server();
    const { current, stripeSubId } = await subscribe(server);
    const res = await deliver(
      server,
      subscriptionUpdated("evt_test_bad_sig", stripeSubId, "past_due"),
      "totally-wrong",
    );
    deepStrictEqual(res.status, 401);
    deepStrictEqual((await current()).data?.status, "active");
  });

  it("returns 401 when the signature header is missing", async () => {
    const server = runtime.server();
    const res = await fetch(`${server.baseUrl}/webhooks/stripe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    deepStrictEqual(res.status, 401);
  });

  it("is idempotent: redelivering the same event id does not fire a second command dispatch", async () => {
    const server = runtime.server();
    const { current, stripeSubId } = await subscribe(server);
    deepStrictEqual(
      (await deliver(server, subscriptionUpdated("evt_test_dedup", stripeSubId, "past_due")))
        .status,
      204,
    );
    deepStrictEqual((await current()).data?.status, "past_due");
    deepStrictEqual(
      (await deliver(server, subscriptionUpdated("evt_test_dedup", stripeSubId, "canceled")))
        .status,
      204,
    );
    deepStrictEqual((await current()).data?.status, "past_due");
  });

  it("is tolerant of unknown event types (204, no command dispatch)", async () => {
    const server = runtime.server();
    const { current } = await subscribe(server);
    const res = await deliver(
      server,
      JSON.stringify({ eventId: "evt_test_unknown", type: "unknown" }),
    );
    deepStrictEqual(res.status, 204);
    deepStrictEqual((await current()).data?.status, "active");
  });
});
