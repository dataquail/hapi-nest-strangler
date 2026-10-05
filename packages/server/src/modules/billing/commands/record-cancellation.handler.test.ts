import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { SubscriptionRepositoryFake } from "../infrastructure/repositories/subscription.repository-fake.js";
import { RecordCancellationCommand } from "./record-cancellation.command.js";
import { RecordCancellationHandler } from "./record-cancellation.handler.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const createdAt = new Date("2026-10-01T00:00:00Z");
const periodEnd = new Date("2026-10-31T00:00:00Z");
const canceledAt = new Date("2026-10-05T12:00:00Z");

const seeded = async () => {
  const subscriptions = new SubscriptionRepositoryFake();
  await subscriptions.insertOne(
    SubscriptionRootOps.create({
      id: SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
      organizationId,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      currentPeriodEnd: periodEnd,
      now: createdAt,
    }).subscription,
  );
  return subscriptions;
};

describe("RecordCancellationHandler", () => {
  it("marks the organization's subscription canceled at the time it is given", async () => {
    const subscriptions = await seeded();
    const handler = new RecordCancellationHandler(subscriptions, PassThroughUnitOfWork);
    const canceled = (
      await handler.execute(new RecordCancellationCommand({ organizationId, canceledAt }))
    ).unwrap();
    deepStrictEqual(canceled.status, "canceled");
    deepStrictEqual(canceled.updatedAt, canceledAt);
    deepStrictEqual(canceled.currentPeriodEnd, periodEnd);
    const stored = (
      await subscriptions.findOne(SubscriptionSpecifications.forOrganization(organizationId))
    ).unwrap();
    deepStrictEqual(stored?.status, "canceled");
  });

  it("is SubscriptionNotFound when the start was never mirrored", async () => {
    const handler = new RecordCancellationHandler(
      new SubscriptionRepositoryFake(),
      PassThroughUnitOfWork,
    );
    const result = await handler.execute(
      new RecordCancellationCommand({ organizationId, canceledAt }),
    );
    deepStrictEqual({ ...result.unwrapErr() }, { _tag: "SubscriptionNotFound", organizationId });
  });
});
