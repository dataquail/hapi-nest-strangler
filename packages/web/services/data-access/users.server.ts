import "server-only";

import { getServerApiClient } from "../api/client.server";
import { prefetchQuery } from "../query/prefetch.server";
import { type UsersListVariables, usersQuery } from "./users.queries";

export const prefetchUsers = async (variables: UsersListVariables): Promise<void> =>
  prefetchQuery(usersQuery(variables, await getServerApiClient()));
