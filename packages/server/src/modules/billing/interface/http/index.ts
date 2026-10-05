import { InternalRecordCancellationEndpoint } from "./internal-record-cancellation.endpoint.js";
import { InternalRecordSubscriptionEndpoint } from "./internal-record-subscription.endpoint.js";
import { InternalRecordWebhookEventEndpoint } from "./internal-record-webhook-event.endpoint.js";

export const billingEndpoints = [
  InternalRecordSubscriptionEndpoint,
  InternalRecordCancellationEndpoint,
  InternalRecordWebhookEventEndpoint,
] as const;
