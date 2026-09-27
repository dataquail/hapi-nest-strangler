import { deepStrictEqual, rejects } from "node:assert";

import { describe, it } from "vitest";
import { z } from "zod";

import type { DeferralSink } from "./deferral.js";
import * as Event from "./event.js";
import { makeEventBus } from "./event-bus.js";
import { makeRecordingEventBus } from "./testing.js";
import { makeUnhandledFailures } from "./unhandled-failures.js";

const OrderPlaced = Event.make("OrderPlaced", { orderId: z.string() });
const OrderShipped = Event.make("OrderShipped", { orderId: z.string() });

describe("EventBus.subscribe", () => {
  it("runs immediate handlers in registration order and awaits them", async () => {
    const bus = makeEventBus();
    const seen: Array<string> = [];
    bus.subscribe(OrderPlaced, async (event) => {
      seen.push(`first:${event.orderId}`);
    });
    bus.subscribe(OrderPlaced, async (event) => {
      seen.push(`second:${event.orderId}`);
    });
    await bus.dispatch([OrderPlaced.make({ orderId: "o-1" })]);
    deepStrictEqual(seen, ["first:o-1", "second:o-1"]);
  });

  it("propagates an immediate handler's failure out of dispatch", async () => {
    const bus = makeEventBus();
    bus.subscribe(OrderPlaced, () => Promise.reject(new Error("boom")));
    await rejects(bus.dispatch([OrderPlaced.make({ orderId: "o-1" })]), /boom/);
  });

  it("delivers only to handlers of the event's tag", async () => {
    const bus = makeEventBus();
    const seen: Array<string> = [];
    bus.subscribe(OrderShipped, async () => {
      seen.push("shipped");
    });
    await bus.dispatch([OrderPlaced.make({ orderId: "o-1" })]);
    deepStrictEqual(seen, []);
  });
});

describe("EventBus.subscribeAfterCommit without a sink", () => {
  it("runs after every immediate handler, at the end of the dispatch", async () => {
    const bus = makeEventBus();
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(OrderPlaced, async () => {
      seen.push("after");
    });
    bus.subscribe(OrderPlaced, async () => {
      seen.push("immediate");
    });
    await bus.dispatch([OrderPlaced.make({ orderId: "o-1" })]);
    deepStrictEqual(seen, ["immediate", "after"]);
  });

  it("isolates a failing after-commit handler and reports it", async () => {
    const failures = makeUnhandledFailures({ log: () => {} });
    const bus = makeEventBus({ unhandledFailures: failures });
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(OrderPlaced, () => Promise.reject(new Error("mail down")));
    bus.subscribeAfterCommit(OrderPlaced, async () => {
      seen.push("second still runs");
    });
    await bus.dispatch([OrderPlaced.make({ orderId: "o-1" })]);
    deepStrictEqual(seen, ["second still runs"]);
    deepStrictEqual(failures.failures().length, 1);
    deepStrictEqual(failures.failures()[0]?.source, "OrderPlaced#0");
    deepStrictEqual(failures.failures()[0]?.kind, "after-commit-handler");
  });
});

describe("EventBus with a DeferralSink", () => {
  it("hands events to the sink before any immediate handler and does not drain itself", async () => {
    const bus = makeEventBus();
    const seen: Array<string> = [];
    const sink: DeferralSink = {
      defer: (events) => {
        seen.push(`deferred:${events.map((e) => e._tag).join(",")}`);
      },
    };
    bus.attachDeferralSink(sink);
    bus.subscribe(OrderPlaced, async () => {
      seen.push("immediate");
    });
    bus.subscribeAfterCommit(OrderPlaced, async () => {
      seen.push("after");
    });
    await bus.dispatch([OrderPlaced.make({ orderId: "o-1" })]);
    deepStrictEqual(seen, ["deferred:OrderPlaced", "immediate"]);
  });

  it("drain runs each after-commit handler through the boundary", async () => {
    const bus = makeEventBus();
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(OrderPlaced, async () => {
      seen.push("handler");
    });
    await bus.drain([OrderPlaced.make({ orderId: "o-1" })], async (reaction) => {
      seen.push("enter");
      const result = await reaction();
      seen.push("exit");
      return result;
    });
    deepStrictEqual(seen, ["enter", "handler", "exit"]);
  });

  it("refuses a second sink", () => {
    const bus = makeEventBus();
    bus.attachDeferralSink({ defer: () => {} });
    let threw = false;
    try {
      bus.attachDeferralSink({ defer: () => {} });
    } catch {
      threw = true;
    }
    deepStrictEqual(threw, true);
  });
});

describe("EventBus.stream", () => {
  it("delivers drained events matching the requested tags, and closes", async () => {
    const bus = makeEventBus();
    const stream = bus.stream(["OrderShipped"]);
    const iterator = stream[Symbol.asyncIterator]();
    await bus.drain([OrderPlaced.make({ orderId: "o-1" }), OrderShipped.make({ orderId: "o-1" })]);
    const first = await iterator.next();
    deepStrictEqual(first, { value: { _tag: "OrderShipped", orderId: "o-1" }, done: false });
    stream.close();
    deepStrictEqual(await iterator.next(), { value: undefined, done: true });
  });
});

describe("RecordingEventBus", () => {
  it("records dispatched events and filters them by definition", async () => {
    const bus = makeRecordingEventBus();
    await bus.dispatch([
      OrderPlaced.make({ orderId: "o-1" }),
      OrderShipped.make({ orderId: "o-1" }),
    ]);
    deepStrictEqual(bus.byTag(OrderShipped), [{ _tag: "OrderShipped", orderId: "o-1" }]);
    deepStrictEqual(bus.dispatched().length, 2);
    bus.clear();
    deepStrictEqual(bus.dispatched(), []);
  });
});
