// ViewModel for the pending-invitations section: the open invitations and the
// two writes each row offers.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import type { Schemas } from "@/services/api/types";
import {
  orgInvitationsQuery,
  resendInvitation,
  revokeInvitation,
} from "@/services/data-access/org-members.queries";
import { formatDay } from "@/services/format/date.shared";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type InvitationRowView = {
  readonly invitationId: string;
  readonly email: string;
  readonly isExpired: boolean;
  readonly expiresAtLabel: string;
};

export type OrgInvitationsListView = {
  readonly rows: ReadonlyArray<InvitationRowView>;
  readonly isEmpty: boolean;
};

export const computeOrgInvitationsListView = (
  invitations: ReadonlyArray<Schemas["PendingInvitation"]>,
): OrgInvitationsListView => ({
  rows: invitations.map((invitation) => ({
    invitationId: invitation.invitationId,
    email: invitation.inviteeEmail,
    isExpired: invitation.status === "expired",
    expiresAtLabel: formatDay(invitation.expiresAt),
  })),
  isEmpty: invitations.length === 0,
});

export type OrgInvitationsListViewModel = OrgInvitationsListView & {
  readonly resend: (invitationId: string) => void;
  readonly revoke: (invitationId: string) => void;
  readonly isResending: boolean;
  readonly isRevoking: boolean;
};

const INVITATION_ERRORS = {
  OrganizationNotFoundError: (error: { readonly message: string }) => error.message,
  InvitationNotFoundError: (error: { readonly message: string }) => error.message,
  InvitationGoneError: (error: { readonly message: string }) => error.message,
  Forbidden: (error: { readonly message: string }) => error.message,
};

type InvitationInput = Parameters<typeof resendInvitation>[0];

export const useOrgInvitationsListViewModel = (
  orgId: OrganizationId,
): OrgInvitationsListViewModel => {
  const { data } = useSuspenseQuery(orgInvitationsQuery(orgId));
  const view = React.useMemo(
    () => computeOrgInvitationsListView(data.invitations),
    [data.invitations],
  );
  const asInput = (invitationId: string): InvitationInput => ({
    orgId,
    invitationId: invitationId as InvitationInput["invitationId"],
  });
  const invalidates = [queryKeys.organizationInvitations.all];

  const resending = useApiMutation({
    mutationFn: (invitationId: string) => resendInvitation(asInput(invitationId)),
    invalidates,
    notify: { success: () => "Invitation resent.", errors: INVITATION_ERRORS },
  });
  const revoking = useApiMutation({
    mutationFn: (invitationId: string) => revokeInvitation(asInput(invitationId)),
    invalidates,
    notify: { success: () => "Invitation revoked.", errors: INVITATION_ERRORS },
  });

  return {
    ...view,
    resend: resending.mutate,
    revoke: revoking.mutate,
    isResending: resending.isPending,
    isRevoking: revoking.isPending,
  };
};
