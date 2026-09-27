import type { ResourceCheck } from "@/platform/auth/authz.js";

import type { OrganizationAuthzView } from "../queries/find-organization-by-id.query.js";
import type { UserOrganizationLookup } from "./is-member.policy.js";

export const makeIsOrgAdmin =
  (isAdmin: UserOrganizationLookup): ResourceCheck<OrganizationAuthzView> =>
  (caller, organization) =>
    isAdmin(caller.userId, organization.organizationId);
