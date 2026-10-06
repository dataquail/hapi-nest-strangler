import { deepStrictEqual } from "node:assert";

import { makeEventBus } from "@org/event-bus";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { SyncSubscriptionPayload } from "@/modules/billing/commands/sync-subscription.command.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/webhook-event/stripe-webhook.events.js";
import type { StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.js";
import type { AppCommandBus } from "@/platform/cqrs/command-bus.js";

import { StripeWebhookEventAdapter } from "./stripe-webhook.event-adapter.js";

const stripeSubId = "sub_test";

const subEvent = (
  type: "created" | "updated" | "deleted",
  status = "past_due",
): StripeWebhookEvent => ({
  eventId: `evt_test_${type}`,
  type: `customer.subscription.${type}`,
  subscription: { stripeSubscriptionId: stripeSubId, status, currentPeriodEnd: null },
});

const dispatchAndReadCommands = async (stripeEvent: StripeWebhookEvent) => {
  const payloads: Array<SyncSubscriptionPayload> = [];
  const commandBus = {
    execute: (command: { payload: SyncSubscriptionPayload }) => {
      payloads.push(command.payload);
      return Promise.resolve(Ok(undefined));
    },
  } as unknown as AppCommandBus;
  const bus = makeEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(bus);
  new StripeWebhookEventAdapter(bus, commandBus).onModuleInit();
  await unitOfWork.run(() => bus.dispatch([StripeWebhookIngested.make({ stripeEvent })]));
  return payloads;
};

describe("StripeWebhookEventAdapter", () => {
  it("on customer.subscription.updated → dispatches SyncSubscriptionCommand with the reported status", async () => {
    deepStrictEqual(await dispatchAndReadCommands(subEvent("updated", "active")), [
      { stripeSubscriptionId: stripeSubId, status: "active", currentPeriodEnd: null },
    ]);
  });

  it("on customer.subscription.deleted → maps status to 'canceled'", async () => {
    const payloads = await dispatchAndReadCommands(subEvent("deleted"));
    deepStrictEqual(payloads.length, 1);
    deepStrictEqual(payloads[0]?.status, "canceled");
  });

  it("on invoice.paid and unknown → dispatches nothing", async () => {
    deepStrictEqual(
      await dispatchAndReadCommands({
        eventId: "evt_invoice",
        type: "invoice.paid",
        invoice: { stripeSubscriptionId: null },
      }),
      [],
    );
    deepStrictEqual(await dispatchAndReadCommands({ eventId: "evt_unknown", type: "unknown" }), []);
  });
});
