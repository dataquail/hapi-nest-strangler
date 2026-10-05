import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { billingCommandHandlers, billingCommands } from "./billing.command-handlers.js";
import { billingQueries, billingQueryHandlers } from "./billing.query-handlers.js";

describe("billing module registration", () => {
  it("routes every command it declares to exactly one handler", () => {
    assertHandlersCover("command", billingCommands, billingCommandHandlers);
  });

  it("routes every query it declares to exactly one handler", () => {
    assertHandlersCover("query", billingQueries, billingQueryHandlers);
  });
});
