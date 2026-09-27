// ViewModel for the organization member roster: the rows it renders and the
// three writes a row offers. Keyed by the org, so the super-admin drill-in and
// an org-admin's own members page are two independent cache entries.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import type { Schemas } from "@/services/api/types";
import {
  demoteMember,
  orgMembersQuery,
  promoteMember,
  removeMember,
} from "@/services/data-access/org-members.queries";
import { formatDay } from "@/services/format/date.shared";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type MemberRowView = {
  readonly userId: string;
  readonly email: string;
  readonly joinedAtLabel: string;
  readonly isAdmin: boolean;
};

export type OrgMembersListView = {
  readonly rows: ReadonlyArray<MemberRowView>;
  readonly isEmpty: boolean;
};

export const computeOrgMembersListView = (
  members: ReadonlyArray<Schemas["OrganizationMember"]>,
): OrgMembersListView => ({
  rows: members.map((member) => ({
    userId: member.userId,
    email: member.email,
    joinedAtLabel: formatDay(member.joinedAt),
    isAdmin: member.isAdmin,
  })),
  isEmpty: members.length === 0,
});

export type OrgMembersListViewModel = OrgMembersListView & {
  readonly remove: (userId: string) => void;
  readonly promote: (userId: string) => void;
  readonly demote: (userId: string) => void;
  readonly isChangingRole: boolean;
  readonly isRemoving: boolean;
};

const MEMBER_ERRORS = {
  OrganizationNotFoundError: (error: { readonly message: string }) => error.message,
  MembershipNotFoundError: (error: { readonly message: string }) => error.message,
  OrganizationRoleConflictError: (error: { readonly message: string }) => error.message,
  Forbidden: (error: { readonly message: string }) => error.message,
};

type MemberInput = Parameters<typeof removeMember>[0];

export const useOrgMembersListViewModel = (orgId: OrganizationId): OrgMembersListViewModel => {
  const { data } = useSuspenseQuery(orgMembersQuery(orgId));
  const view = React.useMemo(() => computeOrgMembersListView(data.members), [data.members]);
  const asInput = (userId: string): MemberInput => ({
    orgId,
    userId: userId as MemberInput["userId"],
  });
  const invalidates = [queryKeys.organizationMembers.all];

  const removal = useApiMutation({
    mutationFn: (userId: string) => removeMember(asInput(userId)),
    invalidates,
    notify: { success: () => "Member removed.", errors: MEMBER_ERRORS },
  });
  const promotion = useApiMutation({
    mutationFn: (userId: string) => promoteMember(asInput(userId)),
    invalidates,
    notify: { success: () => "Member promoted to admin.", errors: MEMBER_ERRORS },
  });
  const demotion = useApiMutation({
    mutationFn: (userId: string) => demoteMember(asInput(userId)),
    invalidates,
    notify: { success: () => "Member demoted from admin.", errors: MEMBER_ERRORS },
  });

  return {
    ...view,
    remove: removal.mutate,
    promote: promotion.mutate,
    demote: demotion.mutate,
    // One in-flight role change at a time, so an impatient second click cannot double-promote.
    isChangingRole: promotion.isPending || demotion.isPending,
    isRemoving: removal.isPending,
  };
};
