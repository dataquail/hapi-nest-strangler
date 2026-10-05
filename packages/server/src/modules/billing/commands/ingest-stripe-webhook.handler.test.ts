import { deepStrictEqual, ok } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { StripeWebhookIngested } from "../domain/webhook-event/stripe-webhook.events.js";
import type { StripeWebhookEvent } from "../domain/webhook-event/stripe-webhook.value-object.js";
import { WebhookEventSpecifications } from "../domain/webhook-event/webhook-event.specification.js";
import {
  BillingGatewayFake,
  FAKE_WEBHOOK_SIGNATURE,
} from "../infrastructure/clients/billing-gateway.client-fake.js";
import { WebhookEventRepositoryFake } from "../infrastructure/repositories/webhook-event.repository-fake.js";
import { IngestStripeWebhookCommand } from "./ingest-stripe-webhook.command.js";
import { IngestStripeWebhookHandler } from "./ingest-stripe-webhook.handler.js";

const subscriptionUpdated = (eventId: string): StripeWebhookEvent => ({
  eventId,
  type: "customer.subscription.updated",
  subscription: { stripeSubscriptionId: "sub_test", status: "past_due", currentPeriodEnd: null },
});

const cmd = (eventId: string, signature = FAKE_WEBHOOK_SIGNATURE) =>
  new IngestStripeWebhookCommand({
    payload: JSON.stringify(subscriptionUpdated(eventId)),
    signature,
  });

const setup = () => {
  const webhookEvents = new WebhookEventRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  const handler = new IngestStripeWebhookHandler(
    new BillingGatewayFake(),
    webhookEvents,
    events,
    unitOfWork,
  );
  return { webhookEvents, events, handler };
};

describe("IngestStripeWebhookHandler", () => {
  it("on first delivery: verifies signature, claims the id, emits StripeWebhookIngested", async () => {
    const { events, handler, webhookEvents } = setup();
    (await handler.execute(cmd("evt_new"))).unwrap();
    ok(
      (
        await webhookEvents.findOne(WebhookEventSpecifications.withStripeEventId("evt_new"))
      ).unwrap() !== null,
    );
    const ingested = events.byTag(StripeWebhookIngested);
    deepStrictEqual(ingested.length, 1);
    deepStrictEqual(ingested[0]?.stripeEvent.eventId, "evt_new");
  });

  it("on bad signature: fails InvalidWebhookSignature, no claim, no event", async () => {
    const { events, handler, webhookEvents } = setup();
    const result = await handler.execute(cmd("evt_bad_sig", "wrong-signature"));
    deepStrictEqual(result.unwrapErr()._tag, "InvalidWebhookSignature");
    deepStrictEqual(
      (
        await webhookEvents.findOne(WebhookEventSpecifications.withStripeEventId("evt_bad_sig"))
      ).unwrap(),
      null,
    );
    deepStrictEqual(events.dispatched(), []);
  });

  it("on redelivery: short-circuits without emitting a second event", async () => {
    const { events, handler } = setup();
    (await handler.execute(cmd("evt_dup"))).unwrap();
    (await handler.execute(cmd("evt_dup"))).unwrap();
    deepStrictEqual(events.byTag(StripeWebhookIngested).length, 1);
  });
});
