// Todos, as the Model sees them. Every endpoint is org-scoped, so the org is
// part of the query's identity: two orgs are two cache entries.

import type { TodosContract } from "@org/contracts/api/Contracts";
import type { OrganizationId, TodoId } from "@org/contracts/EntityIds";
import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../api/api-error";
import { type ApiClient, getApiClient } from "../api/client.shared";
import { queryKeys } from "../api/query-keys";
import type { Schemas } from "../api/types";

export const todosQuery = (orgId: OrganizationId, client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.todos.list(orgId),
    queryFn: async () =>
      unwrap(await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId } } })),
  });

export const createTodo = async (
  input: { readonly orgId: OrganizationId; readonly payload: TodosContract.CreateTodoPayload },
  client: ApiClient = getApiClient(),
): Promise<Schemas["Todo"]> =>
  unwrap(
    await client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId: input.orgId } },
      body: input.payload,
    }),
  );

export const updateTodo = async (
  input: {
    readonly orgId: OrganizationId;
    readonly id: TodoId;
    readonly payload: TodosContract.UpdateTodoPayload;
  },
  client: ApiClient = getApiClient(),
): Promise<Schemas["Todo"]> =>
  unwrap(
    await client.PUT("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId: input.orgId, id: input.id } },
      body: input.payload,
    }),
  );

export const deleteTodo = async (
  input: { readonly orgId: OrganizationId; readonly id: TodoId },
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(
    await client.DELETE("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId: input.orgId, id: input.id } },
    }),
  );
};
