import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { CreateUserCommand } from "./commands/create-user.command.js";
import { CreateUserHandler } from "./commands/create-user.handler.js";
import { DeleteUserCommand } from "./commands/delete-user.command.js";
import { DeleteUserHandler } from "./commands/delete-user.handler.js";

export const userCommands = [CreateUserCommand, DeleteUserCommand] as const;

export const userCommandHandlers = [CreateUserHandler, DeleteUserHandler] as const;

export const userCommandSpanAttributes: MessageSpanAttributes = {
  DeleteUserCommand: ({ payload }: DeleteUserCommand) => ({ "user.id": payload.userId }),
};
