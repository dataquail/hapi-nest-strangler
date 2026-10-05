import { GetCurrentSubscriptionEndpoint } from "./get-current-subscription.endpoint.js";
import { InternalRecordCancellationEndpoint } from "./internal-record-cancellation.endpoint.js";
import { InternalRecordSubscriptionEndpoint } from "./internal-record-subscription.endpoint.js";
import { InternalRecordWebhookEventEndpoint } from "./internal-record-webhook-event.endpoint.js";

export const billingEndpoints = [
  GetCurrentSubscriptionEndpoint,
  InternalRecordSubscriptionEndpoint,
  InternalRecordCancellationEndpoint,
  InternalRecordWebhookEventEndpoint,
] as const;
