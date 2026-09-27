import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { walletCommandHandlers, walletCommands } from "./wallet.command-handlers.js";

describe("wallet module registration", () => {
  it("routes every command it declares to exactly one handler", () => {
    assertHandlersCover("command", walletCommands, walletCommandHandlers);
  });
});
