import { deepStrictEqual, rejects } from "node:assert";

import { Event, makeEventBus } from "@org/event-bus";
import { Err, Ok } from "oxide.ts";
import { describe, it } from "vitest";
import { z } from "zod";

import { PersistenceUnavailable } from "./persistence-unavailable.js";
import { driverFailingWith, makePassThroughUnitOfWork, makeRecordingDriver } from "./testing.js";
import { TransactionFailed } from "./transaction-driver.js";
import { EventDispatchedOutsideUnitOfWork, makeUnitOfWork } from "./unit-of-work.js";

const Happened = Event.make("Happened", { id: z.string() });

describe("UnitOfWork.run re-entrancy", () => {
  it("opens a transaction for the outermost call and a savepoint for a nested one", async () => {
    const { driver, scopes } = makeRecordingDriver();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: makeEventBus() });
    const value = await unitOfWork.run(async () => {
      const inner = await unitOfWork.run(() => Promise.resolve("inner"));
      return `outer+${inner}`;
    });
    deepStrictEqual(value, "outer+inner");
    deepStrictEqual(scopes(), ["transaction", "savepoint"]);
  });

  it("rolls back and rethrows when the function throws", async () => {
    const { driver } = makeRecordingDriver();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: makeEventBus() });
    await rejects(
      unitOfWork.run(() => Promise.reject(new Error("boom"))),
      /boom/,
    );
  });

  it("surfaces the driver's own failure", async () => {
    const { unitOfWork } = makeUnitOfWork({
      driver: driverFailingWith(new TransactionFailed({ message: "commit refused" })),
      eventBus: makeEventBus(),
    });
    await rejects(
      unitOfWork.run(() => Promise.resolve(1)),
      TransactionFailed,
    );
  });

  it("surfaces PersistenceUnavailable from the driver as a rejection", async () => {
    const { unitOfWork } = makeUnitOfWork({
      driver: driverFailingWith(new PersistenceUnavailable({ message: "gone" })),
      eventBus: makeEventBus(),
    });
    await rejects(
      unitOfWork.run(() => Promise.resolve(1)),
      PersistenceUnavailable,
    );
  });
});

describe("UnitOfWork.run and typed failures", () => {
  it("returns an Err unchanged and discards the scope", async () => {
    const { driver, scopes } = makeRecordingDriver();
    const bus = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: bus });
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(Happened, async () => {
      seen.push("after");
    });
    const result = await unitOfWork.run(async () => {
      await bus.dispatch([Happened.make({ id: "1" })]);
      return Err("nope");
    });
    deepStrictEqual(result.isErr(), true);
    deepStrictEqual(result.unwrapErr(), "nope");
    deepStrictEqual(scopes(), ["transaction"]);
    deepStrictEqual(seen, []);
  });

  it("returns an Ok and drains after-commit reactions once the outermost scope commits", async () => {
    const { driver } = makeRecordingDriver();
    const bus = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: bus });
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(Happened, async (event) => {
      seen.push(`after:${event.id}`);
    });
    bus.subscribe(Happened, async (event) => {
      seen.push(`immediate:${event.id}`);
    });
    const result = await unitOfWork.run(async () => {
      await bus.dispatch([Happened.make({ id: "1" })]);
      seen.push("body-done");
      return Ok("done");
    });
    deepStrictEqual(result.unwrap(), "done");
    deepStrictEqual(seen, ["immediate:1", "body-done", "after:1"]);
  });
});

describe("after-commit buffering across nested scopes", () => {
  it("a caught nested failure discards only what the nested scope deferred", async () => {
    const { driver } = makeRecordingDriver();
    const bus = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: bus });
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(Happened, async (event) => {
      seen.push(event.id);
    });
    await unitOfWork.run(async () => {
      await bus.dispatch([Happened.make({ id: "outer" })]);
      await unitOfWork
        .run(async () => {
          await bus.dispatch([Happened.make({ id: "nested" })]);
          throw new Error("nested failed");
        })
        .catch(() => undefined);
      await bus.dispatch([Happened.make({ id: "outer-2" })]);
    });
    deepStrictEqual(seen, ["outer", "outer-2"]);
  });

  it("each after-commit reaction runs in its own unit of work", async () => {
    const { driver, scopes } = makeRecordingDriver();
    const bus = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: bus });
    bus.subscribeAfterCommit(Happened, async () => {});
    await unitOfWork.run(async () => {
      await bus.dispatch([Happened.make({ id: "1" })]);
    });
    deepStrictEqual(scopes(), ["transaction", "transaction"]);
  });

  it("a reaction that fails is isolated from the others and from the publisher", async () => {
    const { driver } = makeRecordingDriver();
    const bus = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver, eventBus: bus });
    const seen: Array<string> = [];
    bus.subscribeAfterCommit(Happened, () => Promise.reject(new Error("first fails")));
    bus.subscribeAfterCommit(Happened, async () => {
      seen.push("second");
    });
    const value = await unitOfWork.run(async () => {
      await bus.dispatch([Happened.make({ id: "1" })]);
      return "committed";
    });
    deepStrictEqual(value, "committed");
    deepStrictEqual(seen, ["second"]);
  });
});

describe("dispatch outside a unit of work", () => {
  it("dies with EventDispatchedOutsideUnitOfWork before any handler runs", async () => {
    const bus = makeEventBus();
    makeUnitOfWork({ driver: makeRecordingDriver().driver, eventBus: bus });
    const seen: Array<string> = [];
    bus.subscribe(Happened, async () => {
      seen.push("ran");
    });
    await rejects(bus.dispatch([Happened.make({ id: "1" })]), EventDispatchedOutsideUnitOfWork);
    deepStrictEqual(seen, []);
  });
});

describe("makePassThroughUnitOfWork", () => {
  it("is the real boundary over the recording driver", async () => {
    const { eventBus, unitOfWork } = makePassThroughUnitOfWork();
    const seen: Array<string> = [];
    eventBus.subscribeAfterCommit(Happened, async () => {
      seen.push("after");
    });
    await unitOfWork.run(() => eventBus.dispatch([Happened.make({ id: "1" })]));
    deepStrictEqual(seen, ["after"]);
  });
});
