import { deepStrictEqual, throws } from "node:assert";

import { describe, it } from "vitest";
import { z } from "zod";

import * as Event from "./event.js";

const OrderPlaced = Event.make("OrderPlaced", { orderId: z.string(), total: z.number() });

describe("Event.make", () => {
  it("stamps the tag onto the payload", () => {
    const event = OrderPlaced.make({ orderId: "o-1", total: 3 });
    deepStrictEqual(event, { _tag: "OrderPlaced", orderId: "o-1", total: 3 });
    deepStrictEqual(OrderPlaced.tag, "OrderPlaced");
  });

  it("rejects a payload that does not match its shape", () => {
    throws(() => OrderPlaced.make({ orderId: "o-1", total: "three" } as never));
  });

  it("narrows an event by tag", () => {
    const event: Event.Base = OrderPlaced.make({ orderId: "o-1", total: 3 });
    deepStrictEqual(OrderPlaced.is(event), true);
    deepStrictEqual(OrderPlaced.is({ _tag: "Other" }), false);
  });
});
