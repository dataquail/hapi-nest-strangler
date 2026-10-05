import { InternalRecordCancellationEndpoint } from "./internal-record-cancellation.endpoint.js";
import { InternalRecordSubscriptionEndpoint } from "./internal-record-subscription.endpoint.js";

export const billingEndpoints = [
  InternalRecordSubscriptionEndpoint,
  InternalRecordCancellationEndpoint,
] as const;
