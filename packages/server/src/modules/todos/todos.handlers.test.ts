import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { todoCommandHandlers, todoCommands } from "./todo.command-handlers.js";
import { todoQueries, todoQueryHandlers } from "./todo.query-handlers.js";

describe("todos module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", todoCommands, todoCommandHandlers);
    assertHandlersCover("query", todoQueries, todoQueryHandlers);
  });
});
