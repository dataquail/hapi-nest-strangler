import Stripe from "stripe";

import config = require("../../../config");
import { problem } from "../../lib/problem";
import { createFakeGateway } from "./fake-stripe-gateway";
import type { StripeGateway, StripeWebhookEvent } from "./stripe-gateway-contract";

type StripeConfig = { secretKey: string; webhookSecret: string; priceId: string; useFake: boolean };

const badGateway = (message: string) => problem(502, "BadGateway", { message });
const invalidSignature = (message: string) => problem(401, "Unauthorized", { message });

// Stripe SDK v22+ moved `current_period_end` from the subscription to each
// item; the wire still carries it on the parent for older API versions.
const readPeriodEnd = (sub: Stripe.Subscription): Date | null => {
  const top = (sub as any).current_period_end;
  const first = (sub as any).items?.data?.[0]?.current_period_end;
  const epoch = typeof top === "number" ? top : typeof first === "number" ? first : null;
  return epoch === null ? null : new Date(epoch * 1000);
};

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
          currentPeriodEnd: readPeriodEnd(sub),
        },
      };
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subRef = (event.data.object as any).subscription;
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

// The only file that talks to Stripe; every other billing file goes through it.
const createLiveGateway = (settings: StripeConfig): StripeGateway => {
  const stripe = new Stripe(settings.secretKey, { typescript: true });
  return {
    async createCustomer(input) {
      try {
        const customer = await stripe.customers.create({
          metadata: { organization_id: input.organizationId },
        });
        return { stripeCustomerId: customer.id };
      } catch (cause) {
        throw badGateway(`Stripe customer create failed: ${String(cause)}`);
      }
    },
    async createSubscription(input) {
      try {
        const sub = await stripe.subscriptions.create({
          customer: input.stripeCustomerId,
          items: [{ price: settings.priceId }],
        });
        return {
          stripeSubscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: readPeriodEnd(sub),
        };
      } catch (cause) {
        throw badGateway(`Stripe subscription create failed: ${String(cause)}`);
      }
    },
    async cancelSubscription(input) {
      try {
        const sub = await stripe.subscriptions.cancel(input.stripeSubscriptionId);
        return { status: sub.status, currentPeriodEnd: readPeriodEnd(sub) };
      } catch (cause) {
        throw badGateway(`Stripe subscription cancel failed: ${String(cause)}`);
      }
    },
    // `constructEvent` needs the exact raw bytes the signature was computed over.
    verifyAndParseWebhook(input) {
      try {
        return toDomainStripeEvent(
          stripe.webhooks.constructEvent(input.payload, input.signature, settings.webhookSecret),
        );
      } catch (cause) {
        throw invalidSignature(`Stripe webhook signature verification failed: ${String(cause)}`);
      }
    },
  };
};

const stripeGateway = (): StripeGateway => {
  const settings: StripeConfig = config("/stripe");
  return settings.useFake ? createFakeGateway() : createLiveGateway(settings);
};

stripeGateway["@singleton"] = true;

export = stripeGateway;
