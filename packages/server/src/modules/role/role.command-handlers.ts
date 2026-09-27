import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { GrantRoleCommand } from "./commands/grant-role.command.js";
import { GrantRoleHandler } from "./commands/grant-role.handler.js";
import { RevokeRoleCommand } from "./commands/revoke-role.command.js";
import { RevokeRoleHandler } from "./commands/revoke-role.handler.js";

export const roleCommands = [GrantRoleCommand, RevokeRoleCommand] as const;

export const roleCommandHandlers = [GrantRoleHandler, RevokeRoleHandler] as const;

export const roleCommandSpanAttributes: MessageSpanAttributes = {
  GrantRoleCommand: ({ payload }: GrantRoleCommand) => ({
    "user.id": payload.userId,
    "role.name": payload.role,
    "actor.user.id": payload.actorUserId,
  }),
  RevokeRoleCommand: ({ payload }: RevokeRoleCommand) => ({
    "user.id": payload.userId,
    "role.name": payload.role,
  }),
};
