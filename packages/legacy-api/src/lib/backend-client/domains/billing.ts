import type { HttpClient } from "../http";

export type MirroredSubscriptionStart = {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
  createdAt: string;
};

export type MirroredCancellation = { organizationId: string; canceledAt: string };

export type MirroredWebhookEvent = {
  stripeEventId: string;
  receivedAt: string;
  subscription: {
    stripeSubscriptionId: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
};

// The Nest server's internal billing API, which records every billing write
// hapi makes while it still owns billing. The provider has already answered by
// the time a write is forwarded, so the Nest side never calls it again.
export const createBillingApi = (http: HttpClient) => ({
  recordStart: ({ organizationId, ...body }: MirroredSubscriptionStart) =>
    http.post(`/internal/orgs/${organizationId}/billing/subscriptions`, body),
  recordCancellation: ({ organizationId, ...body }: MirroredCancellation) =>
    http.post(`/internal/orgs/${organizationId}/billing/subscriptions/current/cancellation`, body),
  recordWebhookEvent: (event: MirroredWebhookEvent) =>
    http.post("/internal/billing/webhook-events", event),
});
