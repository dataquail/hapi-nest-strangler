import "server-only";

import { getServerApiClient } from "../api/client.server";
import { prefetchQuery } from "../query/prefetch.server";
import { adminOrgsQuery, type AdminOrgsVariables, myOrgsQuery } from "./orgs.queries";

export const prefetchMyOrgs = async (): Promise<void> =>
  prefetchQuery(myOrgsQuery(await getServerApiClient()));

export const prefetchAdminOrgs = async (variables: AdminOrgsVariables): Promise<void> =>
  prefetchQuery(adminOrgsQuery(variables, await getServerApiClient()));
