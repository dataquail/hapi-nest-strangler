import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { getServerApiClient } from "../api/client.server";
import { prefetchQuery } from "../query/prefetch.server";
import { subscriptionQuery } from "./billing.queries";

export const prefetchSubscription = async (orgId: OrganizationId): Promise<void> =>
  prefetchQuery(subscriptionQuery(orgId, await getServerApiClient()));
