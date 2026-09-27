export type SubscriptionState = {
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | null;
};

export type StripeWebhookEvent =
  | {
      eventId: string;
      type:
        | "customer.subscription.created"
        | "customer.subscription.updated"
        | "customer.subscription.deleted";
      subscription: SubscriptionState;
    }
  | {
      eventId: string;
      type: "invoice.paid" | "invoice.payment_failed";
      invoice: { stripeSubscriptionId: string | null };
    }
  | { eventId: string; type: "unknown" };

export type StripeGateway = {
  createCustomer(input: { organizationId: string }): Promise<{ stripeCustomerId: string }>;
  createSubscription(input: { stripeCustomerId: string }): Promise<SubscriptionState>;
  cancelSubscription(input: {
    stripeSubscriptionId: string;
  }): Promise<{ status: string; currentPeriodEnd: Date | null }>;
  verifyAndParseWebhook(input: { payload: string; signature: string }): StripeWebhookEvent;
};
