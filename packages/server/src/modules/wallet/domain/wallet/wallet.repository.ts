import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { WalletAlreadyExistsForOrganization } from "./wallet.errors.js";
import type { WalletRoot } from "./wallet.root.js";

// `insertOne` keeps its conflict channel: the unique index on organization_id
// is the idempotency guard the create handler swallows.
export abstract class WalletRepository {
  public abstract insertOne(
    wallet: WalletRoot,
  ): Promise<Result<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<WalletRoot>,
  ): Promise<Result<WalletRoot | null, PersistenceUnavailable>>;
}
