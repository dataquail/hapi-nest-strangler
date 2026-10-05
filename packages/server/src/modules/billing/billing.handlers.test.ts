import { describe, it } from "vitest";

import { assertHandlersCover } from "@/platform/cqrs/messages.js";

import { billingCommandHandlers, billingCommands } from "./billing.command-handlers.js";

describe("billing module registration", () => {
  it("routes every command it declares to exactly one handler", () => {
    assertHandlersCover("command", billingCommands, billingCommandHandlers);
  });
});
