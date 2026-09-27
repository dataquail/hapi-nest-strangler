// The member-management surface: the roster, the open invitations, and the
// writes that change either. One roster endpoint backs both the org-admin
// members page and the super-admin drill-in.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { InvitationId, OrganizationId, UserId } from "@org/contracts/EntityIds";
import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../api/api-error";
import { type ApiClient, getApiClient } from "../api/client.shared";
import { queryKeys } from "../api/query-keys";
import type { Schemas } from "../api/types";

export type MemberInput = { readonly orgId: OrganizationId; readonly userId: UserId };
export type InvitationInput = {
  readonly orgId: OrganizationId;
  readonly invitationId: InvitationId;
};

export const orgMembersQuery = (orgId: OrganizationId, client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.organizationMembers.list(orgId),
    queryFn: async () =>
      unwrap(await client.GET("/orgs/{orgId}/members", { params: { path: { orgId } } })),
  });

export const orgInvitationsQuery = (orgId: OrganizationId, client: ApiClient = getApiClient()) =>
  queryOptions({
    queryKey: queryKeys.organizationInvitations.list(orgId),
    queryFn: async () =>
      unwrap(await client.GET("/orgs/{orgId}/invitations", { params: { path: { orgId } } })),
  });

export const removeMember = async (
  { orgId, userId }: MemberInput,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(
    await client.DELETE("/orgs/{orgId}/members/{userId}", { params: { path: { orgId, userId } } }),
  );
};

export const promoteMember = async (
  { orgId, userId }: MemberInput,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(
    await client.POST("/orgs/{orgId}/members/{userId}/admin", {
      params: { path: { orgId, userId } },
    }),
  );
};

export const demoteMember = async (
  { orgId, userId }: MemberInput,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(
    await client.DELETE("/orgs/{orgId}/members/{userId}/admin", {
      params: { path: { orgId, userId } },
    }),
  );
};

export const resendInvitation = async (
  { invitationId, orgId }: InvitationInput,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(
    await client.POST("/orgs/{orgId}/invitations/{invitationId}/resend", {
      params: { path: { orgId, invitationId } },
    }),
  );
};

export const revokeInvitation = async (
  { invitationId, orgId }: InvitationInput,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(
    await client.DELETE("/orgs/{orgId}/invitations/{invitationId}", {
      params: { path: { orgId, invitationId } },
    }),
  );
};

export const inviteUser = async (
  input: {
    readonly orgId: OrganizationId;
    readonly payload: OrganizationContract.InviteUserPayload;
  },
  client: ApiClient = getApiClient(),
): Promise<Schemas["InviteUserResponse"]> =>
  unwrap(
    await client.POST("/orgs/{orgId}/invitations", {
      params: { path: { orgId: input.orgId } },
      body: input.payload,
    }),
  );
