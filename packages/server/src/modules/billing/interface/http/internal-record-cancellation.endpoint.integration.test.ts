import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const canceledAt = "2026-10-05T12:00:00.000Z";

describe.sequential(
  "POST /internal/orgs/{organizationId}/billing/subscriptions/current/cancellation (integration)",
  () => {
    const runtime = useServerTestRuntime(["billing.subscriptions"]);

    const cancel = () =>
      runtime
        .server()
        .client.POST("/internal/orgs/{organizationId}/billing/subscriptions/current/cancellation", {
          params: { path: { organizationId } },
          body: { canceledAt },
        });

    it("records the cancellation on the mirrored subscription", async () => {
      await runtime.server().client.POST("/internal/orgs/{organizationId}/billing/subscriptions", {
        params: { path: { organizationId } },
        body: {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          stripeCustomerId: "cus_test_1",
          stripeSubscriptionId: "sub_test_1",
          status: "active",
          currentPeriodEnd: "2026-10-31T00:00:00.000Z",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      });
      const res = await cancel();
      deepStrictEqual(res.response.status, 200);
      ok(res.data !== undefined, JSON.stringify(res.error));
      deepStrictEqual(res.data.status, "canceled");
      deepStrictEqual(res.data.currentPeriodEnd, "2026-10-31T00:00:00.000Z");
    });

    it("returns 404 InternalSubscriptionNotFoundError when no start was mirrored", async () => {
      const res = await cancel();
      deepStrictEqual(res.response.status, 404);
      deepStrictEqual(res.error?._tag, "InternalSubscriptionNotFoundError");
    });

    it("returns 401 Unauthorized without the inter-service token", async () => {
      const res = await fetch(
        `${runtime.server().baseUrl}/internal/orgs/${organizationId}/billing/subscriptions/current/cancellation`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ canceledAt }),
        },
      );
      deepStrictEqual(res.status, 401);
    });
  },
);
