import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { SubscriptionRepositoryFake } from "../infrastructure/repositories/subscription.repository-fake.js";
import { RecordSubscriptionCommand } from "./record-subscription.command.js";
import { RecordSubscriptionHandler } from "./record-subscription.handler.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const id = SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const createdAt = new Date("2026-10-01T00:00:00Z");
const periodEnd = new Date("2026-10-31T00:00:00Z");

const record = (stripeSubscriptionId = "sub_1") =>
  new RecordSubscriptionCommand({
    id,
    organizationId,
    stripeCustomerId: "cus_1",
    stripeSubscriptionId,
    status: "active",
    currentPeriodEnd: periodEnd,
    createdAt,
  });

describe("RecordSubscriptionHandler", () => {
  it("stores the subscription under the ids and timestamps it is given", async () => {
    const subscriptions = new SubscriptionRepositoryFake();
    const handler = new RecordSubscriptionHandler(subscriptions, PassThroughUnitOfWork);
    const recorded = (await handler.execute(record())).unwrap();
    deepStrictEqual(recorded.id, id);
    deepStrictEqual(recorded.createdAt, createdAt);
    deepStrictEqual(recorded.updatedAt, createdAt);
    const stored = (
      await subscriptions.findOne(SubscriptionSpecifications.forOrganization(organizationId))
    ).unwrap();
    deepStrictEqual(stored?.stripeSubscriptionId, "sub_1");
    deepStrictEqual(stored?.currentPeriodEnd, periodEnd);
  });

  it("refuses a second subscription for the same organization", async () => {
    const handler = new RecordSubscriptionHandler(
      new SubscriptionRepositoryFake(),
      PassThroughUnitOfWork,
    );
    await handler.execute(record());
    const again = await handler.execute(record("sub_2"));
    deepStrictEqual(again.unwrapErr()._tag, "SubscriptionAlreadyExistsForOrganization");
  });
});
