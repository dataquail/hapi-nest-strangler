import { problem } from "../../lib/problem";
import type {
  StripeGateway,
  StripeWebhookEvent,
  SubscriptionState,
} from "./stripe-gateway-contract";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const invalidSignature = (message: string) => problem(401, "Unauthorized", { message });

// Tests synthesize a webhook by JSON-encoding a StripeWebhookEvent and
// passing this signature; any other signature fails as invalid.
export const FAKE_WEBHOOK_SIGNATURE = "t=fake,v1=fake";

// In-memory stand-in for the provider: customers, subscriptions, transitions.
export const createFakeGateway = (): StripeGateway & {
  subscriptions: Map<string, SubscriptionState>;
} => {
  const customers = new Map<string, string>();
  const subscriptions = new Map<string, SubscriptionState>();
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}_test_${(counter += 1)}`;
  return {
    subscriptions,
    async createCustomer(input) {
      const existing = customers.get(input.organizationId);
      if (existing) return { stripeCustomerId: existing };
      const id = nextId("cus");
      customers.set(input.organizationId, id);
      return { stripeCustomerId: id };
    },
    async createSubscription() {
      const state: SubscriptionState = {
        stripeSubscriptionId: nextId("sub"),
        status: "active",
        currentPeriodEnd: new Date(Date.now() + THIRTY_DAYS_MS),
      };
      subscriptions.set(state.stripeSubscriptionId, state);
      return state;
    },
    async cancelSubscription(input) {
      const found = subscriptions.get(input.stripeSubscriptionId);
      if (!found) return { status: "canceled", currentPeriodEnd: null };
      const updated = { ...found, status: "canceled" };
      subscriptions.set(input.stripeSubscriptionId, updated);
      return { status: updated.status, currentPeriodEnd: updated.currentPeriodEnd };
    },
    verifyAndParseWebhook(input) {
      if (input.signature !== FAKE_WEBHOOK_SIGNATURE)
        throw invalidSignature("fake gateway: signature mismatch");
      let parsed: any;
      try {
        parsed = JSON.parse(input.payload);
      } catch {
        throw invalidSignature("fake gateway: invalid JSON");
      }
      if (typeof parsed?.eventId !== "string" || typeof parsed?.type !== "string") {
        throw invalidSignature("fake gateway: payload is not a webhook event");
      }
      if (parsed.subscription?.currentPeriodEnd) {
        parsed.subscription.currentPeriodEnd = new Date(parsed.subscription.currentPeriodEnd);
      }
      return parsed as StripeWebhookEvent;
    },
  };
};
