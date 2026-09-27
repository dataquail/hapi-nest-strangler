import { Err, Ok, type Result } from "oxide.ts";

import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import type { OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export class OrganizationRepositoryFake extends OrganizationRepository {
  private readonly store = new Map<OrganizationId, OrganizationRoot>();

  public insertOne(organization: OrganizationRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(organization.id, organization);
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(
    organization: OrganizationRoot,
  ): Promise<Result<void, OrganizationNotFound | PersistenceUnavailable>> {
    if (!this.store.has(organization.id)) {
      return Promise.resolve(Err(new OrganizationNotFound({ organizationId: organization.id })));
    }
    this.store.set(organization.id, organization);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<OrganizationRoot>,
  ): Promise<Result<OrganizationRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
