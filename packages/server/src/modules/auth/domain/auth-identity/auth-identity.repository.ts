import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

// A lookup table, not an aggregate: which IdP subject maps to which user.
export type AuthIdentity = {
  readonly subject: string;
  readonly userId: UserId;
  readonly provider: string;
};

export abstract class AuthIdentityRepository {
  public abstract findOne(
    spec: Specification<AuthIdentity>,
  ): Promise<Result<AuthIdentity | null, PersistenceUnavailable>>;
  public abstract insertOne(identity: AuthIdentity): Promise<Result<void, PersistenceUnavailable>>;
}
