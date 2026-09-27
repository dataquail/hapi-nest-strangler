import { Ok, type Result } from "oxide.ts";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import type { OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class OrganizationRolesRepositoryFake extends OrganizationRolesRepository {
  private readonly store = new Map<string, OrganizationRolesRoot>();

  public upsertOne(
    organizationRoles: OrganizationRolesRoot,
  ): Promise<Result<void, PersistenceUnavailable>> {
    const key = `${organizationRoles.userId}:${organizationRoles.organizationId}`;
    if (organizationRoles.roles.length === 0) this.store.delete(key);
    else this.store.set(key, organizationRoles);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<OrganizationRolesRoot>,
  ): Promise<Result<OrganizationRolesRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
