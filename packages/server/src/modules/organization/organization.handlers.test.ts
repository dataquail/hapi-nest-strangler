import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import {
  organizationCommandHandlers,
  organizationCommands,
} from "./organization.command-handlers.js";
import { organizationQueries, organizationQueryHandlers } from "./organization.query-handlers.js";

describe("organization module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", organizationCommands, organizationCommandHandlers);
    assertHandlersCover("query", organizationQueries, organizationQueryHandlers);
  });
});
