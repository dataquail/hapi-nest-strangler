import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { WalletAlreadyExistsForOrganization, WalletNotFound } from "./wallet.errors.js";
import type { WalletRoot } from "./wallet.root.js";

// `insertOne` keeps its conflict channel and `deleteOne` its absence channel:
// the unique index on organization_id is the idempotency guard the create and
// delete handlers each swallow.
export abstract class WalletRepository {
  public abstract insertOne(
    wallet: WalletRoot,
  ): Promise<Result<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>>;
  public abstract deleteOne(
    organizationId: OrganizationId,
  ): Promise<Result<void, WalletNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<WalletRoot>,
  ): Promise<Result<WalletRoot | null, PersistenceUnavailable>>;
}
