import type { ResourceCheck } from "@/platform/auth/authz.js";

import type { OrganizationAccess } from "../domain/ports/acl/organization-access.acl.js";
import type { BillingResourceContext } from "./billing.resource-resolver.js";

// "May this caller commit the org to a subscription?" Which role confers that
// authority is the adapter's decision; this check only asks.
export const makeIsBillingOrgAdmin =
  (organizations: OrganizationAccess): ResourceCheck<BillingResourceContext> =>
  (caller, resource) =>
    organizations.isAdmin(caller.userId, resource.organizationId);
