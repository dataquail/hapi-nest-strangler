import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { CancelSubscriptionCommand } from "./commands/cancel-subscription.command.js";
import { CancelSubscriptionHandler } from "./commands/cancel-subscription.handler.js";
import { IngestStripeWebhookCommand } from "./commands/ingest-stripe-webhook.command.js";
import { IngestStripeWebhookHandler } from "./commands/ingest-stripe-webhook.handler.js";
import { StartSubscriptionCommand } from "./commands/start-subscription.command.js";
import { StartSubscriptionHandler } from "./commands/start-subscription.handler.js";
import { SyncSubscriptionCommand } from "./commands/sync-subscription.command.js";
import { SyncSubscriptionHandler } from "./commands/sync-subscription.handler.js";

export const billingCommands = [
  StartSubscriptionCommand,
  CancelSubscriptionCommand,
  IngestStripeWebhookCommand,
  SyncSubscriptionCommand,
] as const;

export const billingCommandHandlers = [
  StartSubscriptionHandler,
  CancelSubscriptionHandler,
  IngestStripeWebhookHandler,
  SyncSubscriptionHandler,
] as const;

// Neither webhook field reaches a span: the raw body is unbounded and the
// signature is a credential.
export const billingCommandSpanAttributes: MessageSpanAttributes = {
  StartSubscriptionCommand: ({ payload }: StartSubscriptionCommand) => ({
    "organization.id": payload.organizationId,
  }),
  CancelSubscriptionCommand: ({ payload }: CancelSubscriptionCommand) => ({
    "organization.id": payload.organizationId,
  }),
  SyncSubscriptionCommand: ({ payload }: SyncSubscriptionCommand) => ({
    "billing.stripe.subscription.id": payload.stripeSubscriptionId,
    "billing.subscription.status": payload.status,
  }),
};
