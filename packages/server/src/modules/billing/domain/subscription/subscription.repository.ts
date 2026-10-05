import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { SubscriptionAlreadyExistsForOrganization } from "./subscription.errors.js";
import type { SubscriptionRoot } from "./subscription.root.js";

// Absence is a plain `null`; mapping it to SubscriptionNotFound is the handler's job.
export abstract class SubscriptionRepository {
  public abstract insertOne(
    subscription: SubscriptionRoot,
  ): Promise<Result<void, SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable>>;
  public abstract updateOne(
    subscription: SubscriptionRoot,
  ): Promise<Result<void, PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<SubscriptionRoot>,
  ): Promise<Result<SubscriptionRoot | null, PersistenceUnavailable>>;
}
