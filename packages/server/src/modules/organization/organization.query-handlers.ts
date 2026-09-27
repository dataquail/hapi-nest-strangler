import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindAllOrganizationsHandler } from "./queries/find-all-organizations.handler.js";
import { FindAllOrganizationsQuery } from "./queries/find-all-organizations.query.js";
import { FindMembershipHandler } from "./queries/find-membership.handler.js";
import { FindMembershipQuery } from "./queries/find-membership.policy-query.js";
import { FindMyOrganizationsHandler } from "./queries/find-my-organizations.handler.js";
import { FindMyOrganizationsQuery } from "./queries/find-my-organizations.query.js";
import { FindOrganizationByIdHandler } from "./queries/find-organization-by-id.handler.js";
import { FindOrganizationByIdQuery } from "./queries/find-organization-by-id.query.js";
import { FindOrganizationMembershipsHandler } from "./queries/find-organization-memberships.handler.js";
import { FindOrganizationMembershipsQuery } from "./queries/find-organization-memberships.query.js";
import { FindPendingInvitationsHandler } from "./queries/find-pending-invitations.handler.js";
import { FindPendingInvitationsQuery } from "./queries/find-pending-invitations.query.js";
import { FindUserOrganizationRolesHandler } from "./queries/find-user-organization-roles.handler.js";
import { FindUserOrganizationRolesQuery } from "./queries/find-user-organization-roles.policy-query.js";

export const organizationQueries = [
  FindAllOrganizationsQuery,
  FindMyOrganizationsQuery,
  FindOrganizationByIdQuery,
  FindOrganizationMembershipsQuery,
  FindPendingInvitationsQuery,
  FindMembershipQuery,
  FindUserOrganizationRolesQuery,
] as const;

export const organizationQueryHandlers = [
  FindAllOrganizationsHandler,
  FindMyOrganizationsHandler,
  FindOrganizationByIdHandler,
  FindOrganizationMembershipsHandler,
  FindPendingInvitationsHandler,
  FindMembershipHandler,
  FindUserOrganizationRolesHandler,
] as const;

export const organizationQuerySpanAttributes: MessageSpanAttributes = {
  FindAllOrganizationsQuery: ({ payload }: FindAllOrganizationsQuery) => ({
    "query.page": payload.page,
    "query.pageSize": payload.pageSize,
    "query.includeDeleted": payload.includeDeleted,
  }),
  FindMyOrganizationsQuery: ({ payload }: FindMyOrganizationsQuery) => ({
    "user.id": payload.userId,
  }),
  FindOrganizationByIdQuery: ({ payload }: FindOrganizationByIdQuery) => ({
    "organization.id": payload.organizationId,
  }),
  FindOrganizationMembershipsQuery: ({ payload }: FindOrganizationMembershipsQuery) => ({
    "organization.id": payload.organizationId,
  }),
  FindPendingInvitationsQuery: ({ payload }: FindPendingInvitationsQuery) => ({
    "organization.id": payload.organizationId,
  }),
  FindMembershipQuery: ({ payload }: FindMembershipQuery) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
  }),
  FindUserOrganizationRolesQuery: ({ payload }: FindUserOrganizationRolesQuery) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
  }),
};
