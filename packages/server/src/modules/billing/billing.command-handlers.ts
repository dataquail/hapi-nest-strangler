import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { CancelSubscriptionCommand } from "./commands/cancel-subscription.command.js";
import { CancelSubscriptionHandler } from "./commands/cancel-subscription.handler.js";
import { IngestStripeWebhookCommand } from "./commands/ingest-stripe-webhook.command.js";
import { IngestStripeWebhookHandler } from "./commands/ingest-stripe-webhook.handler.js";
import { RecordCancellationCommand } from "./commands/record-cancellation.command.js";
import { RecordCancellationHandler } from "./commands/record-cancellation.handler.js";
import { RecordSubscriptionCommand } from "./commands/record-subscription.command.js";
import { RecordSubscriptionHandler } from "./commands/record-subscription.handler.js";
import { RecordWebhookEventCommand } from "./commands/record-webhook-event.command.js";
import { RecordWebhookEventHandler } from "./commands/record-webhook-event.handler.js";
import { StartSubscriptionCommand } from "./commands/start-subscription.command.js";
import { StartSubscriptionHandler } from "./commands/start-subscription.handler.js";
import { SyncSubscriptionCommand } from "./commands/sync-subscription.command.js";
import { SyncSubscriptionHandler } from "./commands/sync-subscription.handler.js";

export const billingCommands = [
  StartSubscriptionCommand,
  CancelSubscriptionCommand,
  IngestStripeWebhookCommand,
  SyncSubscriptionCommand,
  RecordSubscriptionCommand,
  RecordCancellationCommand,
  RecordWebhookEventCommand,
] as const;

export const billingCommandHandlers = [
  StartSubscriptionHandler,
  CancelSubscriptionHandler,
  IngestStripeWebhookHandler,
  SyncSubscriptionHandler,
  RecordSubscriptionHandler,
  RecordCancellationHandler,
  RecordWebhookEventHandler,
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
  RecordSubscriptionCommand: ({ payload }: RecordSubscriptionCommand) => ({
    "organization.id": payload.organizationId,
    "billing.subscription.id": payload.id,
  }),
  RecordCancellationCommand: ({ payload }: RecordCancellationCommand) => ({
    "organization.id": payload.organizationId,
  }),
  RecordWebhookEventCommand: ({ payload }: RecordWebhookEventCommand) => ({
    "billing.stripe.event.id": payload.stripeEventId,
  }),
};
