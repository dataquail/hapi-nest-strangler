import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { SubscriptionNotFound } from "../domain/subscription/subscription.errors.js";
import type { SubscriptionRoot } from "../domain/subscription/subscription.root.js";

// A cancellation the legacy API has already made with the provider, recorded
// at the time it made it; nothing here reaches the provider.
export type RecordCancellationPayload = {
  readonly organizationId: OrganizationId;
  readonly canceledAt: Date;
};

export type RecordCancellationResult = Result<
  SubscriptionRoot,
  SubscriptionNotFound | PersistenceUnavailable
>;

export class RecordCancellationCommand extends Command<RecordCancellationResult> {
  constructor(public readonly payload: RecordCancellationPayload) {
    super();
  }
}
