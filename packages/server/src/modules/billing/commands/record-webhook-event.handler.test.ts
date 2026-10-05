import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { WebhookEventSpecifications } from "../domain/webhook-event/webhook-event.specification.js";
import { SubscriptionRepositoryFake } from "../infrastructure/repositories/subscription.repository-fake.js";
import { WebhookEventRepositoryFake } from "../infrastructure/repositories/webhook-event.repository-fake.js";
import { RecordWebhookEventCommand } from "./record-webhook-event.command.js";
import { RecordWebhookEventHandler } from "./record-webhook-event.handler.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const receivedAt = new Date("2026-10-05T12:00:00Z");
const nextPeriodEnd = new Date("2026-11-30T00:00:00Z");

const setup = async () => {
  const subscriptions = new SubscriptionRepositoryFake();
  const webhookEvents = new WebhookEventRepositoryFake();
  await subscriptions.insertOne(
    SubscriptionRootOps.create({
      id: SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
      organizationId,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      currentPeriodEnd: null,
      now: new Date("2026-10-01T00:00:00Z"),
    }).subscription,
  );
  const handler = new RecordWebhookEventHandler(
    webhookEvents,
    subscriptions,
    PassThroughUnitOfWork,
  );
  const stored = async () =>
    (
      await subscriptions.findOne(SubscriptionSpecifications.forOrganization(organizationId))
    ).unwrap();
  return { handler, stored, webhookEvents };
};

const event = (stripeEventId: string, status: string, stripeSubscriptionId = "sub_1") =>
  new RecordWebhookEventCommand({
    stripeEventId,
    receivedAt,
    subscription: { stripeSubscriptionId, status, currentPeriodEnd: nextPeriodEnd },
  });

describe("RecordWebhookEventHandler", () => {
  it("claims the event and applies the state the legacy API applied", async () => {
    const { handler, stored, webhookEvents } = await setup();
    (await handler.execute(event("evt_1", "past_due"))).unwrap();
    deepStrictEqual((await stored())?.status, "past_due");
    deepStrictEqual((await stored())?.currentPeriodEnd, nextPeriodEnd);
    deepStrictEqual((await stored())?.updatedAt, receivedAt);
    const claim = (
      await webhookEvents.findOne(WebhookEventSpecifications.withStripeEventId("evt_1"))
    ).unwrap();
    deepStrictEqual(claim?.stripeEventId, "evt_1");
  });

  it("changes nothing for an event it has already claimed", async () => {
    const { handler, stored } = await setup();
    await handler.execute(event("evt_1", "past_due"));
    (await handler.execute(event("evt_1", "active"))).unwrap();
    deepStrictEqual((await stored())?.status, "past_due");
  });

  it("claims an event that carries no subscription state", async () => {
    const { handler, webhookEvents } = await setup();
    (
      await handler.execute(
        new RecordWebhookEventCommand({ stripeEventId: "evt_9", receivedAt, subscription: null }),
      )
    ).unwrap();
    const claim = (
      await webhookEvents.findOne(WebhookEventSpecifications.withStripeEventId("evt_9"))
    ).unwrap();
    deepStrictEqual(claim?.stripeEventId, "evt_9");
  });

  it("drops the state of a subscription it has never seen", async () => {
    const { handler, stored } = await setup();
    (await handler.execute(event("evt_2", "canceled", "sub_unknown"))).unwrap();
    deepStrictEqual((await stored())?.status, "active");
  });
});
