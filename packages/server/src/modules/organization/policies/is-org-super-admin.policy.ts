import type { CurrentUser } from "@org/contracts/Policy";

import type { CallerCheck } from "@/platform/auth/authz.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

import type { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";

export const makeIsOrgSuperAdmin =
  (roles: PlatformRoles): CallerCheck<CurrentUser, PersistenceUnavailable> =>
  (caller) =>
    roles.isSuperAdmin(caller.userId);
