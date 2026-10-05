import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

export type RecordedSubscriptionState = {
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
};

// A provider event the legacy API has already verified and applied: its id is
// claimed here as it was there, and the state it applied, if any, follows.
export type RecordWebhookEventPayload = {
  readonly stripeEventId: string;
  readonly receivedAt: Date;
  readonly subscription: RecordedSubscriptionState | null;
};

export type RecordWebhookEventResult = Result<void, PersistenceUnavailable>;

export class RecordWebhookEventCommand extends Command<RecordWebhookEventResult> {
  constructor(public readonly payload: RecordWebhookEventPayload) {
    super();
  }
}
