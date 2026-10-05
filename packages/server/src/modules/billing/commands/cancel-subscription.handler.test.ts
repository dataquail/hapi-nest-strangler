import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionCanceled } from "../domain/subscription/subscription.events.js";
import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { BillingGatewayFake } from "../infrastructure/clients/billing-gateway.client-fake.js";
import { SubscriptionRepositoryFake } from "../infrastructure/repositories/subscription.repository-fake.js";
import { CancelSubscriptionCommand } from "./cancel-subscription.command.js";
import { CancelSubscriptionHandler } from "./cancel-subscription.handler.js";

const acme = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = new Date("2025-01-01T00:00:00Z");

const setup = async (seeded: boolean) => {
  const subscriptions = new SubscriptionRepositoryFake();
  if (seeded) {
    const { subscription } = SubscriptionRootOps.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: "sub_seed",
      status: "active",
      currentPeriodEnd: null,
      now,
    });
    (await subscriptions.insertOne(subscription)).unwrap();
  }
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  const handler = new CancelSubscriptionHandler(
    subscriptions,
    new BillingGatewayFake(),
    events,
    unitOfWork,
  );
  return { subscriptions, events, handler };
};

describe("CancelSubscriptionHandler", () => {
  it("flips status to 'canceled', persists, publishes SubscriptionCanceled", async () => {
    const { events, handler, subscriptions } = await setup(true);
    const result = (
      await handler.execute(new CancelSubscriptionCommand({ organizationId: acme }))
    ).unwrap();
    deepStrictEqual(result.status, "canceled");
    deepStrictEqual(
      (await subscriptions.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap()
        ?.status,
      "canceled",
    );
    deepStrictEqual(events.byTag(SubscriptionCanceled).length, 1);
  });

  it("fails SubscriptionNotFound when no subscription exists for the org", async () => {
    const { events, handler } = await setup(false);
    const result = await handler.execute(new CancelSubscriptionCommand({ organizationId: acme }));
    deepStrictEqual(result.unwrapErr()._tag, "SubscriptionNotFound");
    deepStrictEqual(events.dispatched(), []);
  });
});
