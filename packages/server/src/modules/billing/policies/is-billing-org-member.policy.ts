import type { ResourceCheck } from "@/platform/auth/authz.js";

import type { OrganizationAccess } from "../domain/ports/acl/organization-access.acl.js";
import type { BillingResourceContext } from "./billing.resource-resolver.js";

export const makeIsBillingOrgMember =
  (organizations: OrganizationAccess): ResourceCheck<BillingResourceContext> =>
  (caller, resource) =>
    organizations.isMember(caller.userId, resource.organizationId);
