import { Err, Ok, type Result } from "oxide.ts";

import {
  BillingGateway,
  type CancelSubscriptionInput,
  type CancelSubscriptionResult,
  type CreateCustomerInput,
  type CreateCustomerResult,
  type CreateSubscriptionInput,
  type SubscriptionState,
  type VerifyWebhookInput,
} from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import {
  type BillingGatewayUnavailable,
  InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription/subscription.errors.js";
import { StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

// Tests synthesize a webhook by JSON-encoding a StripeWebhookEvent and
// passing this signature; any other signature fails as InvalidWebhookSignature.
export const FAKE_WEBHOOK_SIGNATURE = "t=fake,v1=fake";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type SubscriptionRecord = {
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
};

/** In-memory simulator of the provider's surface: customers, subscriptions, status transitions. */
export class BillingGatewayFake extends BillingGateway {
  private readonly customers = new Map<OrganizationId, string>();
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_test_${this.counter}`;
  }

  public createCustomer(
    input: CreateCustomerInput,
  ): Promise<Result<CreateCustomerResult, BillingGatewayUnavailable>> {
    const existing = this.customers.get(input.organizationId);
    if (existing !== undefined) return Promise.resolve(Ok({ stripeCustomerId: existing }));
    const id = this.nextId("cus");
    this.customers.set(input.organizationId, id);
    return Promise.resolve(Ok({ stripeCustomerId: id }));
  }

  public createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<Result<SubscriptionState, BillingGatewayUnavailable>> {
    const record: SubscriptionRecord = {
      stripeSubscriptionId: this.nextId("sub"),
      stripeCustomerId: input.stripeCustomerId,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + THIRTY_DAYS_MS),
    };
    this.subscriptions.set(record.stripeSubscriptionId, record);
    return Promise.resolve(
      Ok({
        stripeSubscriptionId: record.stripeSubscriptionId,
        status: record.status,
        currentPeriodEnd: record.currentPeriodEnd,
      }),
    );
  }

  // Cancel-of-unknown is a no-op from the provider's perspective, as with Stripe.
  public cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<Result<CancelSubscriptionResult, BillingGatewayUnavailable>> {
    const found = this.subscriptions.get(input.stripeSubscriptionId);
    if (found === undefined)
      return Promise.resolve(Ok({ status: "canceled", currentPeriodEnd: null }));
    const updated = { ...found, status: "canceled" };
    this.subscriptions.set(input.stripeSubscriptionId, updated);
    return Promise.resolve(
      Ok({ status: updated.status, currentPeriodEnd: updated.currentPeriodEnd }),
    );
  }

  public verifyAndParseWebhook(
    input: VerifyWebhookInput,
  ): Promise<Result<StripeWebhookEvent, InvalidWebhookSignature>> {
    if (input.signature !== FAKE_WEBHOOK_SIGNATURE) {
      return Promise.resolve(
        Err(new InvalidWebhookSignature({ message: "fake gateway: signature mismatch" })),
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.payload);
    } catch {
      return Promise.resolve(
        Err(new InvalidWebhookSignature({ message: "fake gateway: invalid JSON" })),
      );
    }
    const decoded = StripeWebhookEvent.safeParse(parsed);
    if (!decoded.success) {
      return Promise.resolve(
        Err(
          new InvalidWebhookSignature({
            message: `fake gateway: payload does not match StripeWebhookEvent shape: ${decoded.error.message}`,
          }),
        ),
      );
    }
    return Promise.resolve(Ok(decoded.data));
  }
}
