import { Err, Ok, type Result } from "oxide.ts";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import type { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import type { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class SubscriptionRepositoryFake extends SubscriptionRepository {
  private readonly store = new Map<SubscriptionId, SubscriptionRoot>();

  public insertOne(
    subscription: SubscriptionRoot,
  ): Promise<Result<void, SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable>> {
    const taken = [...this.store.values()].some(
      (s) => s.organizationId === subscription.organizationId,
    );
    if (taken) {
      return Promise.resolve(
        Err(
          new SubscriptionAlreadyExistsForOrganization({
            organizationId: subscription.organizationId,
          }),
        ),
      );
    }
    this.store.set(subscription.id, subscription);
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(subscription: SubscriptionRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(subscription.id, subscription);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<SubscriptionRoot>,
  ): Promise<Result<SubscriptionRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
