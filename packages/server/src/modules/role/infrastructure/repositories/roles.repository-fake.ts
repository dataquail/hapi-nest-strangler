import { Ok, type Result } from "oxide.ts";

import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import type { RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class RolesRepositoryFake extends RolesRepository {
  private readonly store = new Map<UserId, RolesRoot>();

  public upsertOne(roles: RolesRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(roles.userId, roles);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<RolesRoot>,
  ): Promise<Result<RolesRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
