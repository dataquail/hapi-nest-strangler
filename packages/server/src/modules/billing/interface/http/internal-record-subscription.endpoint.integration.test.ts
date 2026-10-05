import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const body = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  stripeCustomerId: "cus_test_1",
  stripeSubscriptionId: "sub_test_1",
  status: "active",
  currentPeriodEnd: "2026-10-31T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
};

describe.sequential(
  "POST /internal/orgs/{organizationId}/billing/subscriptions (integration)",
  () => {
    const runtime = useServerTestRuntime(["billing.subscriptions"]);

    const record = () =>
      runtime.server().client.POST("/internal/orgs/{organizationId}/billing/subscriptions", {
        params: { path: { organizationId } },
        body,
      });

    it("mirrors a subscription under the ids the legacy API and the provider gave it", async () => {
      const res = await record();
      deepStrictEqual(res.response.status, 201);
      ok(res.data !== undefined, JSON.stringify(res.error));
      deepStrictEqual(res.data, {
        id: body.id,
        organizationId,
        stripeCustomerId: body.stripeCustomerId,
        stripeSubscriptionId: body.stripeSubscriptionId,
        status: "active",
        currentPeriodEnd: body.currentPeriodEnd,
      });
    });

    it("returns 409 InternalSubscriptionAlreadyExistsError when the organization's was mirrored before", async () => {
      await record();
      const again = await record();
      deepStrictEqual(again.response.status, 409);
      deepStrictEqual(again.error?._tag, "InternalSubscriptionAlreadyExistsError");
    });

    it("returns 401 Unauthorized without the inter-service token", async () => {
      const res = await fetch(
        `${runtime.server().baseUrl}/internal/orgs/${organizationId}/billing/subscriptions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      deepStrictEqual(res.status, 401);
    });
  },
);
