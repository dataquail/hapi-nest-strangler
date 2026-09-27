import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { RolesRoot } from "./roles.root.js";

export abstract class RolesRepository {
  public abstract upsertOne(roles: RolesRoot): Promise<Result<void, PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<RolesRoot>,
  ): Promise<Result<RolesRoot | null, PersistenceUnavailable>>;
}
