import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { roleCommandHandlers, roleCommands } from "./role.command-handlers.js";
import { roleQueries, roleQueryHandlers } from "./role.query-handlers.js";

describe("role module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", roleCommands, roleCommandHandlers);
    assertHandlersCover("query", roleQueries, roleQueryHandlers);
  });
});
