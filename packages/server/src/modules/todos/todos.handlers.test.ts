import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { todoCommandHandlers, todoCommands } from "./todo.command-handlers.js";

describe("todos module registration", () => {
  it("routes every command it declares to exactly one handler", () => {
    assertHandlersCover("command", todoCommands, todoCommandHandlers);
  });
});
