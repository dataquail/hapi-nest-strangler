import { Err, Ok, type Result } from "oxide.ts";

import type { UserId } from "@/platform/ids/user-id.js";

import { AlreadyHasRole, DoesNotHaveRole } from "./role.errors.js";
import { type RoleEvent, RoleGranted, RoleRevoked } from "./role.events.js";
import type { RoleValueObject } from "./role.value-object.js";
import { RolesRoot } from "./roles.root.js";
import { RolesSpecifications } from "./roles.specification.js";

export type Outcome = {
  readonly roles: RolesRoot;
  readonly events: ReadonlyArray<RoleEvent>;
};

const empty = (userId: UserId): RolesRoot => RolesRoot.parse({ userId, roles: [] });

const grant = (aggregate: RolesRoot, role: RoleValueObject): Result<Outcome, AlreadyHasRole> => {
  if (RolesSpecifications.hasRole(role)(aggregate)) {
    return Err(new AlreadyHasRole({ userId: aggregate.userId, role }));
  }
  return Ok({
    roles: RolesRoot.parse({ userId: aggregate.userId, roles: [...aggregate.roles, role] }),
    events: [RoleGranted.make({ userId: aggregate.userId, role })],
  });
};

const revoke = (aggregate: RolesRoot, role: RoleValueObject): Result<Outcome, DoesNotHaveRole> => {
  if (!RolesSpecifications.hasRole(role)(aggregate)) {
    return Err(new DoesNotHaveRole({ userId: aggregate.userId, role }));
  }
  return Ok({
    roles: RolesRoot.parse({
      userId: aggregate.userId,
      roles: aggregate.roles.filter((r) => (r as string) !== role),
    }),
    events: [RoleRevoked.make({ userId: aggregate.userId, role })],
  });
};

export const RolesRootOps = { empty, grant, revoke } as const;
