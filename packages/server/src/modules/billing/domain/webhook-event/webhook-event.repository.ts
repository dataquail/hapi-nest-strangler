import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { WebhookEventAlreadyRecorded } from "./webhook-event.errors.js";

// Write-once idempotency log keyed by Stripe's event id. `insertOne` is the
// claim: the database's unique key, not the use case, arbitrates a race.
export type WebhookEventRecord = {
  readonly stripeEventId: string;
  readonly receivedAt: Date;
};

export abstract class WebhookEventRepository {
  public abstract insertOne(
    stripeEventId: string,
  ): Promise<Result<void, WebhookEventAlreadyRecorded | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<WebhookEventRecord>,
  ): Promise<Result<WebhookEventRecord | null, PersistenceUnavailable>>;
}
