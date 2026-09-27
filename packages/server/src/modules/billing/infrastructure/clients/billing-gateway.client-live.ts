import { Inject, Injectable } from "@nestjs/common";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { Err, Ok, type Result } from "oxide.ts";
import Stripe from "stripe";

import { EnvVars } from "@/common/env-vars.js";
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
  BillingGatewayUnavailable,
  InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription/subscription.errors.js";
import type { StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.js";

const tracer = trace.getTracer("@org/server/billing");

// Stripe SDK v22+ moved `current_period_end` from the subscription to each
// item; the wire still carries it on the parent for older API versions.
const readPeriodEnd = (sub: Stripe.Subscription): number | null => {
  const top = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  if (typeof top === "number") return top;
  const items = (
    sub as unknown as { items?: { data?: ReadonlyArray<{ current_period_end?: number | null }> } }
  ).items;
  const first = items?.data?.[0]?.current_period_end;
  return typeof first === "number" ? first : null;
};

const epochToDate = (epoch: number | null): Date | null =>
  epoch === null ? null : new Date(epoch * 1000);

const toDomainSubscriptionState = (sub: Stripe.Subscription): SubscriptionState => ({
  stripeSubscriptionId: sub.id,
  status: sub.status,
  currentPeriodEnd: epochToDate(readPeriodEnd(sub)),
});

const toDomainStripeEvent = (event: Stripe.Event): StripeWebhookEvent => {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      return {
        eventId: event.id,
        type: event.type,
        subscription: {
          stripeSubscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: epochToDate(readPeriodEnd(sub)),
        },
      };
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subRef = (event.data.object as unknown as { subscription?: string | null })
        .subscription;
      return {
        eventId: event.id,
        type: event.type,
        invoice: { stripeSubscriptionId: typeof subRef === "string" ? subRef : null },
      };
    }
    default:
      return { eventId: event.id, type: "unknown" };
  }
};

const traced = async <A>(name: string, run: () => Promise<A>): Promise<A> =>
  tracer.startActiveSpan(`BillingGateway.${name}`, async (span) => {
    try {
      return await run();
    } catch (cause) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw cause;
    } finally {
      span.end();
    }
  });

/** The only file that imports `stripe`; every other billing file speaks the port. */
@Injectable()
export class BillingGatewayLive extends BillingGateway {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly priceId: string;

  constructor(@Inject(EnvVars) env: EnvVars) {
    super();
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    this.priceId = env.STRIPE_PRICE_ID_DEFAULT;
  }

  public async createCustomer(
    input: CreateCustomerInput,
  ): Promise<Result<CreateCustomerResult, BillingGatewayUnavailable>> {
    try {
      const customer = await traced("createCustomer", () =>
        this.stripe.customers.create({
          metadata: { organization_id: input.organizationId },
          ...(input.email !== undefined ? { email: input.email } : {}),
        }),
      );
      return Ok({ stripeCustomerId: customer.id });
    } catch (cause) {
      return Err(
        new BillingGatewayUnavailable({
          message: `Stripe customer create failed: ${String(cause)}`,
        }),
      );
    }
  }

  public async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<Result<SubscriptionState, BillingGatewayUnavailable>> {
    try {
      const sub = await traced("createSubscription", () =>
        this.stripe.subscriptions.create({
          customer: input.stripeCustomerId,
          items: [{ price: this.priceId }],
        }),
      );
      return Ok(toDomainSubscriptionState(sub));
    } catch (cause) {
      return Err(
        new BillingGatewayUnavailable({
          message: `Stripe subscription create failed: ${String(cause)}`,
        }),
      );
    }
  }

  public async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<Result<CancelSubscriptionResult, BillingGatewayUnavailable>> {
    try {
      const sub = await traced("cancelSubscription", () =>
        this.stripe.subscriptions.cancel(input.stripeSubscriptionId),
      );
      const state = toDomainSubscriptionState(sub);
      return Ok({ status: state.status, currentPeriodEnd: state.currentPeriodEnd });
    } catch (cause) {
      return Err(
        new BillingGatewayUnavailable({
          message: `Stripe subscription cancel failed: ${String(cause)}`,
        }),
      );
    }
  }

  // `constructEvent` needs the exact raw bytes the signature was computed over.
  public verifyAndParseWebhook(
    input: VerifyWebhookInput,
  ): Promise<Result<StripeWebhookEvent, InvalidWebhookSignature>> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        input.payload,
        input.signature,
        this.webhookSecret,
      );
      return Promise.resolve(Ok(toDomainStripeEvent(event)));
    } catch (cause) {
      return Promise.resolve(
        Err(
          new InvalidWebhookSignature({
            message: `Stripe webhook signature verification failed: ${String(cause)}`,
          }),
        ),
      );
    }
  }
}
