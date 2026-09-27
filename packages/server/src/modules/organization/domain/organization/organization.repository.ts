import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { OrganizationNotFound } from "./organization.errors.js";
import type { OrganizationRoot } from "./organization.root.js";

export abstract class OrganizationRepository {
  public abstract insertOne(
    organization: OrganizationRoot,
  ): Promise<Result<void, PersistenceUnavailable>>;
  public abstract updateOne(
    organization: OrganizationRoot,
  ): Promise<Result<void, OrganizationNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<OrganizationRoot>,
  ): Promise<Result<OrganizationRoot | null, PersistenceUnavailable>>;
}
