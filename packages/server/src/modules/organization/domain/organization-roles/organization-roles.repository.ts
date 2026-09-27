import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { OrganizationRolesRoot } from "./organization-roles.root.js";

export abstract class OrganizationRolesRepository {
  public abstract upsertOne(
    organizationRoles: OrganizationRolesRoot,
  ): Promise<Result<void, PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<OrganizationRolesRoot>,
  ): Promise<Result<OrganizationRolesRoot | null, PersistenceUnavailable>>;
}
