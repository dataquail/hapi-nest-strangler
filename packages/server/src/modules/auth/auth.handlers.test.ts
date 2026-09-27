import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { authCommandHandlers, authCommands } from "./auth.command-handlers.js";
import { authQueries, authQueryHandlers } from "./auth.query-handlers.js";

describe("auth module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", authCommands, authCommandHandlers);
    assertHandlersCover("query", authQueries, authQueryHandlers);
  });
});
