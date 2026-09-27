import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { billingCommandHandlers, billingCommands } from "./billing.command-handlers.js";
import { billingQueries, billingQueryHandlers } from "./billing.query-handlers.js";

describe("billing module registration", () => {
  it("routes every command and query it declares to exactly one handler", () => {
    assertHandlersCover("command", billingCommands, billingCommandHandlers);
    assertHandlersCover("query", billingQueries, billingQueryHandlers);
  });
});
