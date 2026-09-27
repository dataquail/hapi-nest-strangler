import { OrganizationCreated } from "./domain/organization/organization.events.js";
import { FindMembershipQuery } from "./queries/find-membership.policy-query.js";
import { FindUserOrganizationRolesQuery } from "./queries/find-user-organization-roles.policy-query.js";

export const organizationAccessQueries = {
  FindMembershipQuery,
  FindUserOrganizationRolesQuery,
} as const;

export const organizationAccessDomainEvents = { OrganizationCreated } as const;
