import { ok, strictEqual } from "node:assert";

import Stripe from "stripe";
import { describe, it } from "vitest";

import type { EnvVars } from "@/common/env-vars.js";

import { BillingGatewayLive } from "./billing-gateway.client-live.js";

// Covers the half of the port that is local crypto + translation; the
// customer/subscription calls hit Stripe's API and are exercised through the fake.
const WEBHOOK_SECRET = "whsec_test";

const env = {
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_ID_DEFAULT: "price_test",
} as EnvVars;

const signer = new Stripe("sk_test");
const sign = (payload: string): string =>
  signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

const gateway = new BillingGatewayLive(env);

describe("BillingGatewayLive.verifyAndParseWebhook", () => {
  it("rejects a payload whose signature doesn't verify as InvalidWebhookSignature", async () => {
    const result = await gateway.verifyAndParseWebhook({
      payload: "{}",
      signature: "t=1,v1=deadbeef",
    });
    strictEqual(result.unwrapErr()._tag, "InvalidWebhookSignature");
  });

  it("maps a subscription event, reading current_period_end off the top level", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", status: "active", current_period_end: 1_700_000_000 } },
    });
    const event = (
      await gateway.verifyAndParseWebhook({ payload, signature: sign(payload) })
    ).unwrap();
    strictEqual(event.eventId, "evt_1");
    if (event.type !== "customer.subscription.updated") throw new Error("expected sub event");
    strictEqual(event.subscription.stripeSubscriptionId, "sub_1");
    strictEqual(event.subscription.status, "active");
    ok(event.subscription.currentPeriodEnd !== null);
    strictEqual(event.subscription.currentPeriodEnd.getTime(), 1_700_000_000_000);
  });

  it("falls back to items.data[0].current_period_end when the top level is absent", async () => {
    const payload = JSON.stringify({
      id: "evt_2",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_2",
          status: "trialing",
          items: { data: [{ current_period_end: 1_800_000_000 }] },
        },
      },
    });
    const event = (
      await gateway.verifyAndParseWebhook({ payload, signature: sign(payload) })
    ).unwrap();
    if (event.type !== "customer.subscription.created") throw new Error("expected sub event");
    ok(event.subscription.currentPeriodEnd !== null);
    strictEqual(event.subscription.currentPeriodEnd.getTime(), 1_800_000_000_000);
  });

  it("reduces an invoice event to just its subscription reference", async () => {
    const payload = JSON.stringify({
      id: "evt_3",
      type: "invoice.paid",
      data: { object: { id: "in_1", subscription: "sub_3" } },
    });
    const event = (
      await gateway.verifyAndParseWebhook({ payload, signature: sign(payload) })
    ).unwrap();
    if (event.type !== "invoice.paid") throw new Error("expected invoice event");
    strictEqual(event.invoice.stripeSubscriptionId, "sub_3");
  });

  it("records an unmodeled event type as `unknown` so the delivery is still acked", async () => {
    const payload = JSON.stringify({
      id: "evt_4",
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    });
    const event = (
      await gateway.verifyAndParseWebhook({ payload, signature: sign(payload) })
    ).unwrap();
    strictEqual(event.type, "unknown");
    strictEqual(event.eventId, "evt_4");
  });
});
