import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const receivedAt = "2026-10-05T12:00:00.000Z";

describe.sequential("POST /internal/billing/webhook-events (integration)", () => {
  const runtime = useServerTestRuntime(["billing.subscriptions", "billing.webhook_events"]);

  const recordEvent = (stripeEventId: string, status: string) =>
    runtime.server().client.POST("/internal/billing/webhook-events", {
      body: {
        stripeEventId,
        receivedAt,
        subscription: {
          stripeSubscriptionId: "sub_test_1",
          status,
          currentPeriodEnd: "2026-11-30T00:00:00.000Z",
        },
      },
    });

  it("claims the event once and applies the state the legacy API applied", async () => {
    const { client } = runtime.server();
    await client.POST("/internal/orgs/{organizationId}/billing/subscriptions", {
      params: { path: { organizationId } },
      body: {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        stripeCustomerId: "cus_test_1",
        stripeSubscriptionId: "sub_test_1",
        status: "active",
        currentPeriodEnd: null,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    });

    deepStrictEqual((await recordEvent("evt_1", "past_due")).response.status, 204);
    deepStrictEqual((await recordEvent("evt_1", "active")).response.status, 204);

    const canceled = await client.POST(
      "/internal/orgs/{organizationId}/billing/subscriptions/current/cancellation",
      { params: { path: { organizationId } }, body: { canceledAt: receivedAt } },
    );
    deepStrictEqual(canceled.data?.currentPeriodEnd, "2026-11-30T00:00:00.000Z");
  });

  it("returns 401 Unauthorized without the inter-service token", async () => {
    const res = await fetch(`${runtime.server().baseUrl}/internal/billing/webhook-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stripeEventId: "evt_1", receivedAt, subscription: null }),
    });
    deepStrictEqual(res.status, 401);
  });
});
