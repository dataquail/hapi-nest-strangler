import { CancelSubscriptionEndpoint } from "./cancel-subscription.endpoint.js";
import { GetCurrentSubscriptionEndpoint } from "./get-current-subscription.endpoint.js";
import { StartSubscriptionEndpoint } from "./start-subscription.endpoint.js";
import { StripeWebhookEndpoint } from "./stripe-webhook.endpoint.js";

export const billingEndpoints = [
  StartSubscriptionEndpoint,
  GetCurrentSubscriptionEndpoint,
  CancelSubscriptionEndpoint,
  StripeWebhookEndpoint,
] as const;
