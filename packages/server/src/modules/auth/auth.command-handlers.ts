import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { ApproveDeviceGrantCommand } from "./commands/approve-device-grant.command.js";
import { ApproveDeviceGrantHandler } from "./commands/approve-device-grant.handler.js";
import { MintApiTokenCommand } from "./commands/mint-api-token.command.js";
import { MintApiTokenHandler } from "./commands/mint-api-token.handler.js";
import { PollDeviceGrantCommand } from "./commands/poll-device-grant.command.js";
import { PollDeviceGrantHandler } from "./commands/poll-device-grant.handler.js";
import { RevokeApiTokenCommand } from "./commands/revoke-api-token.command.js";
import { RevokeApiTokenHandler } from "./commands/revoke-api-token.handler.js";
import { RevokeSessionCommand } from "./commands/revoke-session.command.js";
import { RevokeSessionHandler } from "./commands/revoke-session.handler.js";
import { SignInCommand } from "./commands/sign-in.command.js";
import { SignInHandler } from "./commands/sign-in.handler.js";
import { StartDeviceGrantCommand } from "./commands/start-device-grant.command.js";
import { StartDeviceGrantHandler } from "./commands/start-device-grant.handler.js";
import { TouchApiTokenCommand } from "./commands/touch-api-token.command.js";
import { TouchApiTokenHandler } from "./commands/touch-api-token.handler.js";
import { TouchSessionCommand } from "./commands/touch-session.command.js";
import { TouchSessionHandler } from "./commands/touch-session.handler.js";

export const authCommands = [
  SignInCommand,
  RevokeSessionCommand,
  TouchSessionCommand,
  MintApiTokenCommand,
  RevokeApiTokenCommand,
  TouchApiTokenCommand,
  StartDeviceGrantCommand,
  ApproveDeviceGrantCommand,
  PollDeviceGrantCommand,
] as const;

export const authCommandHandlers = [
  SignInHandler,
  RevokeSessionHandler,
  TouchSessionHandler,
  MintApiTokenHandler,
  RevokeApiTokenHandler,
  TouchApiTokenHandler,
  StartDeviceGrantHandler,
  ApproveDeviceGrantHandler,
  PollDeviceGrantHandler,
] as const;

// Secrets never reach a span: the sign-in subject, device codes and tokens are
// deliberately absent.
export const authCommandSpanAttributes: MessageSpanAttributes = {
  RevokeSessionCommand: ({ payload }: RevokeSessionCommand) => ({
    "session.id": payload.sessionId,
  }),
  TouchSessionCommand: ({ payload }: TouchSessionCommand) => ({ "session.id": payload.sessionId }),
  MintApiTokenCommand: ({ payload }: MintApiTokenCommand) => ({ "user.id": payload.userId }),
  RevokeApiTokenCommand: ({ payload }: RevokeApiTokenCommand) => ({
    "api_token.id": payload.apiTokenId,
    "user.id": payload.userId,
  }),
  TouchApiTokenCommand: ({ payload }: TouchApiTokenCommand) => ({
    "api_token.id": payload.apiTokenId,
  }),
  ApproveDeviceGrantCommand: ({ payload }: ApproveDeviceGrantCommand) => ({
    "user.id": payload.userId,
  }),
};
