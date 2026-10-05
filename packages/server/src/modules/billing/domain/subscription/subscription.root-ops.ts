import type { OrganizationId } from "@/platform/ids/organization-id.js";

import {
  SubscriptionCanceled,
  type SubscriptionEvent,
  SubscriptionStarted,
  SubscriptionStatusChanged,
} from "./subscription.events.js";
import type { SubscriptionId } from "./subscription.id.js";
import { SubscriptionRoot } from "./subscription.root.js";

export type Outcome = {
  readonly subscription: SubscriptionRoot;
  readonly events: ReadonlyArray<SubscriptionEvent>;
};

export type CreateInput = {
  readonly id: SubscriptionId;
  readonly organizationId: OrganizationId;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
  readonly now: Date;
};

const create = (input: CreateInput): Outcome => {
  const subscription = SubscriptionRoot.parse({
    id: input.id,
    organizationId: input.organizationId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    status: input.status,
    currentPeriodEnd: input.currentPeriodEnd,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    subscription,
    events: [
      SubscriptionStarted.make({
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status,
      }),
    ],
  };
};

export type ApplyStatusInput = {
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
  readonly now: Date;
};

// Idempotent on replay: the post-state is always returned without branching
// on equality; subscribers dedupe on `previousStatus === status`.
const applyStatus = (sub: SubscriptionRoot, input: ApplyStatusInput): Outcome => {
  const subscription = SubscriptionRoot.parse({
    ...sub,
    status: input.status,
    currentPeriodEnd: input.currentPeriodEnd,
    updatedAt: input.now,
  });
  return {
    subscription,
    events: [
      SubscriptionStatusChanged.make({
        subscriptionId: sub.id,
        organizationId: sub.organizationId,
        status: input.status,
        previousStatus: sub.status,
      }),
    ],
  };
};

// The user-initiated case carries its own event so a consumer can tell it
// apart from the status transition webhook playback would report.
const cancel = (sub: SubscriptionRoot, now: Date): Outcome => {
  const subscription = SubscriptionRoot.parse({ ...sub, status: "canceled", updatedAt: now });
  return {
    subscription,
    events: [
      SubscriptionCanceled.make({ subscriptionId: sub.id, organizationId: sub.organizationId }),
    ],
  };
};

export const SubscriptionRootOps = { create, applyStatus, cancel } as const;
