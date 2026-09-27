import type { ResourceCheck } from "@/platform/auth/authz.js";

import type { OrganizationAccess } from "../domain/ports/acl/organization-access.acl.js";
import type { TodoOrgContext } from "./todo.resource-resolvers.js";

export const makeIsTodoOrgMember =
  (organizations: OrganizationAccess): ResourceCheck<TodoOrgContext> =>
  (caller, resource) =>
    organizations.isMember(caller.userId, resource.organizationId);
