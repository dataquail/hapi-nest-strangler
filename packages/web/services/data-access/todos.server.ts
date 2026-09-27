import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { getServerApiClient } from "../api/client.server";
import { prefetchQuery } from "../query/prefetch.server";
import { todosQuery } from "./todos.queries";

export const prefetchTodos = async (orgId: OrganizationId): Promise<void> =>
  prefetchQuery(todosQuery(orgId, await getServerApiClient()));
