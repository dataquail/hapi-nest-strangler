import { z } from "zod";

import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "./subscription.id.js";

export const SubscriptionStarted = Event.make("SubscriptionStarted", {
  subscriptionId: SubscriptionId,
  organizationId: OrganizationId,
  stripeSubscriptionId: z.string(),
  status: z.string(),
});
export type SubscriptionStarted = Event.Type<typeof SubscriptionStarted>;

export const subscriptionStartedSpanAttributes: SpanAttributesExtractor<SubscriptionStarted> = (
  event,
) => ({
  "subscription.id": event.subscriptionId,
  "organization.id": event.organizationId,
  "subscription.stripe_id": event.stripeSubscriptionId,
  "subscription.status": event.status,
});

export const SubscriptionStatusChanged = Event.make("SubscriptionStatusChanged", {
  subscriptionId: SubscriptionId,
  organizationId: OrganizationId,
  status: z.string(),
  previousStatus: z.string(),
});
export type SubscriptionStatusChanged = Event.Type<typeof SubscriptionStatusChanged>;

export const subscriptionStatusChangedSpanAttributes: SpanAttributesExtractor<
  SubscriptionStatusChanged
> = (event) => ({
  "subscription.id": event.subscriptionId,
  "organization.id": event.organizationId,
  "subscription.status": event.status,
  "subscription.previous_status": event.previousStatus,
});

export const SubscriptionCanceled = Event.make("SubscriptionCanceled", {
  subscriptionId: SubscriptionId,
  organizationId: OrganizationId,
});
export type SubscriptionCanceled = Event.Type<typeof SubscriptionCanceled>;

export const subscriptionCanceledSpanAttributes: SpanAttributesExtractor<SubscriptionCanceled> = (
  event,
) => ({
  "subscription.id": event.subscriptionId,
  "organization.id": event.organizationId,
});

export type SubscriptionEvent =
  SubscriptionStarted | SubscriptionStatusChanged | SubscriptionCanceled;
