import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { RecordCancellationCommand } from "./commands/record-cancellation.command.js";
import { RecordCancellationHandler } from "./commands/record-cancellation.handler.js";
import { RecordSubscriptionCommand } from "./commands/record-subscription.command.js";
import { RecordSubscriptionHandler } from "./commands/record-subscription.handler.js";
import { RecordWebhookEventCommand } from "./commands/record-webhook-event.command.js";
import { RecordWebhookEventHandler } from "./commands/record-webhook-event.handler.js";

export const billingCommands = [
  RecordSubscriptionCommand,
  RecordCancellationCommand,
  RecordWebhookEventCommand,
] as const;

export const billingCommandHandlers = [
  RecordSubscriptionHandler,
  RecordCancellationHandler,
  RecordWebhookEventHandler,
] as const;

export const billingCommandSpanAttributes: MessageSpanAttributes = {
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
