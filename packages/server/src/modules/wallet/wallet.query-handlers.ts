import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindWalletByOrganizationHandler } from "./queries/find-wallet-by-organization.handler.js";
import { FindWalletByOrganizationQuery } from "./queries/find-wallet-by-organization.query.js";

export const walletQueries = [FindWalletByOrganizationQuery] as const;

export const walletQueryHandlers = [FindWalletByOrganizationHandler] as const;

export const walletQuerySpanAttributes: MessageSpanAttributes = {
  FindWalletByOrganizationQuery: ({ payload }: FindWalletByOrganizationQuery) => ({
    "organization.id": payload.organizationId,
  }),
};
