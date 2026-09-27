import { Err, Ok, type Result } from "oxide.ts";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import type { MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

const key = (userId: UserId, organizationId: OrganizationId) => `${userId}:${organizationId}`;

export class MembershipRepositoryFake extends MembershipRepository {
  private readonly store = new Map<string, MembershipRoot>();

  public insertOne(membership: MembershipRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(key(membership.userId, membership.organizationId), membership);
    return Promise.resolve(Ok(undefined));
  }

  public deleteOne(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<void, MembershipNotFound | PersistenceUnavailable>> {
    if (!this.store.delete(key(userId, organizationId))) {
      return Promise.resolve(Err(new MembershipNotFound({ userId, organizationId })));
    }
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<MembershipRoot>,
  ): Promise<Result<MembershipRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
