import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// Syncs the local projection to a provider-reported status. The event adapter
// translates Stripe vocabulary before dispatch, so no Stripe type rides here.
export type SyncSubscriptionPayload = {
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
};

export type SyncSubscriptionResult = Result<void, PersistenceUnavailable>;

export class SyncSubscriptionCommand extends Command<SyncSubscriptionResult> {
  constructor(public readonly payload: SyncSubscriptionPayload) {
    super();
  }
}
