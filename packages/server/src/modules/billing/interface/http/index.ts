import { CancelSubscriptionEndpoint } from "./cancel-subscription.endpoint.js";
import { GetCurrentSubscriptionEndpoint } from "./get-current-subscription.endpoint.js";
import { InternalRecordCancellationEndpoint } from "./internal-record-cancellation.endpoint.js";
import { InternalRecordSubscriptionEndpoint } from "./internal-record-subscription.endpoint.js";
import { InternalRecordWebhookEventEndpoint } from "./internal-record-webhook-event.endpoint.js";
import { StartSubscriptionEndpoint } from "./start-subscription.endpoint.js";
import { StripeWebhookEndpoint } from "./stripe-webhook.endpoint.js";

export const billingEndpoints = [
  GetCurrentSubscriptionEndpoint,
  StartSubscriptionEndpoint,
  CancelSubscriptionEndpoint,
  StripeWebhookEndpoint,
  InternalRecordSubscriptionEndpoint,
  InternalRecordCancellationEndpoint,
  InternalRecordWebhookEventEndpoint,
] as const;
