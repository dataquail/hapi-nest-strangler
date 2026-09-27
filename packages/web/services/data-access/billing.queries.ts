// Billing, as the Model sees it: one read and two writes, all org-scoped.
//
// "No subscription yet" arrives from the server as a 404. That is a state the
// panel renders, not a failure it reports, so the absence is folded into `null`
// here, once, rather than in each consumer.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { queryOptions } from "@tanstack/react-query";

import { isApiError, unwrap } from "../api/api-error";
import { type ApiClient, getApiClient } from "../api/client.shared";
import { queryKeys } from "../api/query-keys";
import type { Schemas } from "../api/types";

export type CurrentSubscription = Schemas["SubscriptionResponse"] | null;

export const subscriptionQuery = (orgId: OrganizationId, client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.billing.current(orgId),
    queryFn: async (): Promise<CurrentSubscription> => {
      try {
        return unwrap(
          await client.GET("/orgs/{orgId}/billing/subscriptions/current", {
            params: { path: { orgId } },
          }),
        );
      } catch (error) {
        if (isApiError(error) && error._tag === "SubscriptionNotFoundError") return null;
        throw error;
      }
    },
  });

export const startSubscription = async (
  orgId: OrganizationId,
  client: ApiClient = getApiClient(),
): Promise<Schemas["SubscriptionResponse"]> =>
  unwrap(
    await client.POST("/orgs/{orgId}/billing/subscriptions", {
      params: { path: { orgId } },
      body: {},
    }),
  );

export const cancelSubscription = async (
  orgId: OrganizationId,
  client: ApiClient = getApiClient(),
): Promise<Schemas["SubscriptionResponse"]> =>
  unwrap(
    await client.DELETE("/orgs/{orgId}/billing/subscriptions/current", {
      params: { path: { orgId } },
    }),
  );
