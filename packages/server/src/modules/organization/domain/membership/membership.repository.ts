import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { MembershipNotFound } from "./membership.errors.js";
import type { MembershipRoot } from "./membership.root.js";

export abstract class MembershipRepository {
  public abstract insertOne(
    membership: MembershipRoot,
  ): Promise<Result<void, PersistenceUnavailable>>;
  public abstract deleteOne(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<void, MembershipNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<MembershipRoot>,
  ): Promise<Result<MembershipRoot | null, PersistenceUnavailable>>;
}
