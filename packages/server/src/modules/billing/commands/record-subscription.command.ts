import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { SubscriptionAlreadyExistsForOrganization } from "../domain/subscription/subscription.errors.js";
import type { SubscriptionId } from "../domain/subscription/subscription.id.js";
import type { SubscriptionRoot } from "../domain/subscription/subscription.root.js";

// A subscription the legacy API has already opened with the provider, recorded
// under the ids it gave it; nothing here reaches the provider.
export type RecordSubscriptionPayload = {
  readonly id: SubscriptionId;
  readonly organizationId: OrganizationId;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
  readonly createdAt: Date;
};

export type RecordSubscriptionResult = Result<
  SubscriptionRoot,
  SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable
>;

export class RecordSubscriptionCommand extends Command<RecordSubscriptionResult> {
  constructor(public readonly payload: RecordSubscriptionPayload) {
    super();
  }
}
