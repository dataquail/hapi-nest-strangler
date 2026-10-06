import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

// A duplicate delivery: the unique violation on the idempotency log lifted
// into the typed channel so the use case decides to short-circuit.
export class WebhookEventAlreadyRecorded extends TaggedError("WebhookEventAlreadyRecorded")<{
  readonly stripeEventId: string;
}> {}
