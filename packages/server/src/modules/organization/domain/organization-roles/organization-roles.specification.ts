import {
  type Predicate,
  Spec,
  type Specification,
} from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { OrganizationRoleValueObject } from "./organization-role.value-object.js";
import type { OrganizationRolesRoot } from "./organization-roles.root.js";

const forUser = (userId: UserId): Specification<OrganizationRolesRoot> =>
  Spec.eq<OrganizationRolesRoot, "userId">("userId", userId);
const forOrganization = (organizationId: OrganizationId): Specification<OrganizationRolesRoot> =>
  Spec.eq<OrganizationRolesRoot, "organizationId">("organizationId", organizationId);

const hasRole =
  (role: OrganizationRoleValueObject): Predicate<OrganizationRolesRoot> =>
  (aggregate) =>
    aggregate.roles.some((r) => (r.role as string) === role);

export const OrganizationRolesSpecifications = { forUser, forOrganization, hasRole } as const;
