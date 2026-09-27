import type { SpanAttributes } from "@/platform/ddd/contracts/domain-event.js";

import {
  subscriptionCanceledSpanAttributes,
  subscriptionStartedSpanAttributes,
  subscriptionStatusChangedSpanAttributes,
} from "./domain/subscription/subscription.events.js";
import { stripeWebhookIngestedSpanAttributes } from "./domain/webhook-event/stripe-webhook.events.js";

export const billingEventSpanAttributes: SpanAttributes = {
  SubscriptionStarted: subscriptionStartedSpanAttributes,
  SubscriptionStatusChanged: subscriptionStatusChangedSpanAttributes,
  SubscriptionCanceled: subscriptionCanceledSpanAttributes,
  StripeWebhookIngested: stripeWebhookIngestedSpanAttributes,
};
