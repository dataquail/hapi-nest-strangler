import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import type { WebhookEventRecord } from "./webhook-event.repository.js";
import { WebhookEventSpecifications } from "./webhook-event.specification.js";

const record: WebhookEventRecord = {
  stripeEventId: "evt_abc",
  receivedAt: new Date("2025-01-01T00:00:00Z"),
};

describe("WebhookEventSpecifications.withStripeEventId", () => {
  it("matches the record with the given Stripe event id and no other", () => {
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_abc")(record), true);
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_other")(record), false);
  });

  it("carries an Eq criteria over stripeEventId", () => {
    deepStrictEqual(WebhookEventSpecifications.withStripeEventId("evt_abc").criteria, {
      _tag: "Eq",
      field: "stripeEventId",
      value: "evt_abc",
    });
  });
});
