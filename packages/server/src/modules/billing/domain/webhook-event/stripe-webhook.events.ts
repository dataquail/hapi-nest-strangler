import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";

import {
  type StripeSubscriptionWebhookEvent,
  StripeWebhookEvent,
} from "./stripe-webhook.value-object.js";

// Emitted once a fresh delivery has been verified and the idempotency claim
// is held; carries the parsed event so a subscriber fans out by `type`.
export const StripeWebhookIngested = Event.make("StripeWebhookIngested", {
  stripeEvent: StripeWebhookEvent,
});
export type StripeWebhookIngested = Event.Type<typeof StripeWebhookIngested>;

export const stripeWebhookIngestedSpanAttributes: SpanAttributesExtractor<StripeWebhookIngested> = (
  event,
) => ({
  "stripe.event.id": event.stripeEvent.eventId,
  "stripe.event.type": event.stripeEvent.type,
});

export const isStripeSubscriptionEvent = (
  event: StripeWebhookEvent,
): event is StripeSubscriptionWebhookEvent =>
  event.type === "customer.subscription.created" ||
  event.type === "customer.subscription.updated" ||
  event.type === "customer.subscription.deleted";
