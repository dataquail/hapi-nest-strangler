import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { RecordSubscriptionCommand } from "./commands/record-subscription.command.js";
import { RecordSubscriptionHandler } from "./commands/record-subscription.handler.js";

export const billingCommands = [RecordSubscriptionCommand] as const;

export const billingCommandHandlers = [RecordSubscriptionHandler] as const;

export const billingCommandSpanAttributes: MessageSpanAttributes = {
  RecordSubscriptionCommand: ({ payload }: RecordSubscriptionCommand) => ({
    "organization.id": payload.organizationId,
    "billing.subscription.id": payload.id,
  }),
};
