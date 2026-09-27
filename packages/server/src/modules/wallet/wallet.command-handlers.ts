import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { CreateWalletCommand } from "./commands/create-wallet.command.js";
import { CreateWalletHandler } from "./commands/create-wallet.handler.js";
import { DeleteWalletCommand } from "./commands/delete-wallet.command.js";
import { DeleteWalletHandler } from "./commands/delete-wallet.handler.js";

export const walletCommands = [CreateWalletCommand, DeleteWalletCommand] as const;

export const walletCommandHandlers = [CreateWalletHandler, DeleteWalletHandler] as const;

export const walletCommandSpanAttributes: MessageSpanAttributes = {
  CreateWalletCommand: ({ payload }: CreateWalletCommand) => ({
    "organization.id": payload.organizationId,
  }),
  DeleteWalletCommand: ({ payload }: DeleteWalletCommand) => ({
    "organization.id": payload.organizationId,
  }),
};
