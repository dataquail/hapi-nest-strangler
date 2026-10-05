import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindSubscriptionByOrganizationHandler } from "./queries/find-subscription-by-organization.handler.js";
import { FindSubscriptionByOrganizationQuery } from "./queries/find-subscription-by-organization.query.js";

export const billingQueries = [FindSubscriptionByOrganizationQuery] as const;

export const billingQueryHandlers = [FindSubscriptionByOrganizationHandler] as const;

export const billingQuerySpanAttributes: MessageSpanAttributes = {
  FindSubscriptionByOrganizationQuery: ({ payload }: FindSubscriptionByOrganizationQuery) => ({
    "organization.id": payload.organizationId,
  }),
};
