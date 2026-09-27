import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { CreateWalletCommand } from "./commands/create-wallet.command.js";
import { CreateWalletHandler } from "./commands/create-wallet.handler.js";

export const walletCommands = [CreateWalletCommand] as const;

export const walletCommandHandlers = [CreateWalletHandler] as const;

export const walletCommandSpanAttributes: MessageSpanAttributes = {
  CreateWalletCommand: ({ payload }: CreateWalletCommand) => ({
    "organization.id": payload.organizationId,
  }),
};
