import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { userCommandHandlers, userCommands } from "./user.command-handlers.js";
import { userQueries, userQueryHandlers } from "./user.query-handlers.js";

describe("user module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", userCommands, userCommandHandlers);
    assertHandlersCover("query", userQueries, userQueryHandlers);
  });
});
