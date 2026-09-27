import {
  type Predicate,
  Spec,
  type Specification,
} from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { RoleValueObject } from "./role.value-object.js";
import type { RolesRoot } from "./roles.root.js";

const forUser = (userId: UserId): Specification<RolesRoot> =>
  Spec.eq<RolesRoot, "userId">("userId", userId);

const hasRole =
  (role: RoleValueObject): Predicate<RolesRoot> =>
  (aggregate) =>
    aggregate.roles.includes(role);

export const RolesSpecifications = { forUser, hasRole } as const;
