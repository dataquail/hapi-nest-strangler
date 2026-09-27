// Organizations, as the Model sees them. `findMine` is read by the nav switcher
// and the root picker at once; both reach the same cache entry.
//
// A soft-delete or restore dirties both organization roots: the platform
// listing and every affected member's own switcher.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../api/api-error";
import { type ApiClient, getApiClient } from "../api/client.shared";
import { type AdminOrgsVariables, queryKeys } from "../api/query-keys";
import type { Schemas } from "../api/types";

export type { AdminOrgsVariables };

export const myOrgsQuery = (client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.organizations.mine,
    queryFn: async () => unwrap(await client.GET("/orgs")),
  });

export const adminOrgsQuery = (variables: AdminOrgsVariables, client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.adminOrganizations.list(variables),
    queryFn: async () => unwrap(await client.GET("/admin/orgs", { params: { query: variables } })),
  });

export const createOrg = async (
  payload: OrganizationContract.CreateOrganizationPayload,
  client: ApiClient = getApiClient(),
): Promise<Schemas["CreateOrganizationResponse"]> =>
  unwrap(await client.POST("/orgs", { body: payload }));

export const softDeleteOrg = async (
  id: OrganizationId,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(await client.DELETE("/orgs/{id}", { params: { path: { id } } }));
};

export const restoreOrg = async (
  id: OrganizationId,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(await client.POST("/orgs/{id}/restore", { params: { path: { id } } }));
};

// The accept endpoint sits outside the org group: the caller has no membership
// yet and the URL is token-shaped. Accepting adds a membership, so it dirties
// the caller's own list.
export const acceptInvitation = async (
  token: string,
  client: ApiClient = getApiClient(),
): Promise<Schemas["AcceptInvitationResponse"]> =>
  unwrap(await client.POST("/invitations/{token}/accept", { params: { path: { token } } }));
