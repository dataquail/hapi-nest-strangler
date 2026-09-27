import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { walletCommandHandlers, walletCommands } from "./wallet.command-handlers.js";
import { walletQueries, walletQueryHandlers } from "./wallet.query-handlers.js";

describe("wallet module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", walletCommands, walletCommandHandlers);
    assertHandlersCover("query", walletQueries, walletQueryHandlers);
  });
});
