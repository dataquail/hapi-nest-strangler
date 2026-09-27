import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

import type { InvalidWebhookSignature } from "../domain/subscription/subscription.errors.js";

// `payload` is the exact raw bytes the provider signed; `signature` is the
// stripe-signature header. Neither reaches a span.
export type IngestStripeWebhookPayload = { readonly payload: string; readonly signature: string };

export type IngestStripeWebhookResult = Result<
  void,
  InvalidWebhookSignature | PersistenceUnavailable
>;

export class IngestStripeWebhookCommand extends Command<IngestStripeWebhookResult> {
  constructor(public readonly payload: IngestStripeWebhookPayload) {
    super();
  }
}
