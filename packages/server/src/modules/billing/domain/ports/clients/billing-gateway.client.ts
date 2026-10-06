import type { Result } from "oxide.ts";

import type {
  BillingGatewayUnavailable,
  InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription/subscription.errors.js";
import type { StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export type CreateCustomerInput = {
  readonly organizationId: OrganizationId;
  readonly email?: string;
};

export type CreateCustomerResult = { readonly stripeCustomerId: string };

// The price is a gateway-internal concern (env in production, none in the
// fake) so commands stay gateway-agnostic until a real plan surface exists.
export type CreateSubscriptionInput = { readonly stripeCustomerId: string };

export type SubscriptionState = {
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
};

export type CancelSubscriptionInput = { readonly stripeSubscriptionId: string };

export type CancelSubscriptionResult = {
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
};

export type VerifyWebhookInput = { readonly payload: string; readonly signature: string };

/** The external billing provider, narrowed to what the use cases need. */
export abstract class BillingGateway {
  public abstract createCustomer(
    input: CreateCustomerInput,
  ): Promise<Result<CreateCustomerResult, BillingGatewayUnavailable>>;
  public abstract createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<Result<SubscriptionState, BillingGatewayUnavailable>>;
  public abstract cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<Result<CancelSubscriptionResult, BillingGatewayUnavailable>>;
  public abstract verifyAndParseWebhook(
    input: VerifyWebhookInput,
  ): Promise<Result<StripeWebhookEvent, InvalidWebhookSignature>>;
}
