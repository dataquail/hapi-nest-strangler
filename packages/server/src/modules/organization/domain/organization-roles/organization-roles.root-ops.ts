import { Err, Ok, type Result } from "oxide.ts";

import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import {
  AlreadyHasOrganizationRole,
  DoesNotHaveOrganizationRole,
} from "./organization-role.errors.js";
import {
  type OrganizationRoleEvent,
  OrganizationRoleGranted,
  OrganizationRoleRevoked,
} from "./organization-role.events.js";
import type { OrganizationRoleValueObject } from "./organization-role.value-object.js";
import { OrganizationRolesRoot } from "./organization-roles.root.js";
import { OrganizationRolesSpecifications } from "./organization-roles.specification.js";

export type Outcome = {
  readonly organizationRoles: OrganizationRolesRoot;
  readonly events: ReadonlyArray<OrganizationRoleEvent>;
};

const empty = (userId: UserId, organizationId: OrganizationId): OrganizationRolesRoot =>
  OrganizationRolesRoot.parse({ userId, organizationId, roles: [] });

const grantRole = (
  aggregate: OrganizationRolesRoot,
  role: OrganizationRoleValueObject,
  issuedBy: UserId,
): Result<Outcome, AlreadyHasOrganizationRole> => {
  if (OrganizationRolesSpecifications.hasRole(role)(aggregate)) {
    return Err(
      new AlreadyHasOrganizationRole({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    );
  }
  return Ok({
    organizationRoles: OrganizationRolesRoot.parse({
      ...aggregate,
      roles: [...aggregate.roles, { role, issuedBy }],
    }),
    events: [
      OrganizationRoleGranted.make({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
        issuedBy,
      }),
    ],
  });
};

const revokeRole = (
  aggregate: OrganizationRolesRoot,
  role: OrganizationRoleValueObject,
): Result<Outcome, DoesNotHaveOrganizationRole> => {
  if (!OrganizationRolesSpecifications.hasRole(role)(aggregate)) {
    return Err(
      new DoesNotHaveOrganizationRole({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    );
  }
  return Ok({
    organizationRoles: OrganizationRolesRoot.parse({
      ...aggregate,
      roles: aggregate.roles.filter((r) => (r.role as string) !== role),
    }),
    events: [
      OrganizationRoleRevoked.make({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    ],
  });
};

export const OrganizationRolesRootOps = { empty, grantRole, revokeRole } as const;
