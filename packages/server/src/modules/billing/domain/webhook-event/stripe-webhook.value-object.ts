import { z } from "zod";

// The parsed Stripe webhook the domain reacts to. `unknown` is the bucket for
// event types not modeled yet: recorded and acked so Stripe stops retrying.
const SubscriptionEvent = z.object({
  eventId: z.string(),
  type: z.enum([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]),
  subscription: z.object({
    stripeSubscriptionId: z.string(),
    status: z.string(),
    currentPeriodEnd: z.coerce.date().nullable(),
  }),
});

const InvoiceEvent = z.object({
  eventId: z.string(),
  type: z.enum(["invoice.paid", "invoice.payment_failed"]),
  invoice: z.object({ stripeSubscriptionId: z.string().nullable() }),
});

const UnknownEvent = z.object({ eventId: z.string(), type: z.literal("unknown") });

export const StripeWebhookEvent = z.union([SubscriptionEvent, InvoiceEvent, UnknownEvent]);
export type StripeWebhookEvent = z.infer<typeof StripeWebhookEvent>;
export type StripeSubscriptionWebhookEvent = z.infer<typeof SubscriptionEvent>;
