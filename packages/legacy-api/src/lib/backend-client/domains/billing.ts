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

// The Nest server's internal billing API, which records every billing write
// hapi makes while it still owns billing. The provider has already answered by
// the time a write is forwarded, so the Nest side never calls it again.
export const createBillingApi = (http: HttpClient) => ({
  recordStart: ({ organizationId, ...body }: MirroredSubscriptionStart) =>
    http.post(`/internal/orgs/${organizationId}/billing/subscriptions`, body),
});
