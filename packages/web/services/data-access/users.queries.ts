// Users, as the Model sees them: one query and one write.

import type { UserContract } from "@org/contracts/api/Contracts";
import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../api/api-error";
import { type ApiClient, getApiClient } from "../api/client.shared";
import { queryKeys, type UsersListVariables } from "../api/query-keys";
import type { Schemas } from "../api/types";

export type { UsersListVariables };

export const usersQuery = (variables: UsersListVariables, client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.users.list(variables),
    queryFn: async () => unwrap(await client.GET("/users", { params: { query: variables } })),
  });

export const createUser = async (
  payload: UserContract.CreateUserPayload,
  client: ApiClient = getApiClient(),
): Promise<Schemas["CreateUserResponse"]> => unwrap(await client.POST("/users", { body: payload }));
