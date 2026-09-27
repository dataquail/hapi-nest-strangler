import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserSpecifications } from "../domain/user/user.specification.js";
import { UserRepositoryFake } from "../infrastructure/repositories/user.repository-fake.js";
import { CreateUserCommand } from "./create-user.command.js";
import { CreateUserHandler } from "./create-user.handler.js";

const setup = () => {
  const users = new UserRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return { users, events, handler: new CreateUserHandler(users, events, unitOfWork) };
};

describe("CreateUserHandler", () => {
  it("stores the user with its address and emits UserCreated", async () => {
    const { events, handler, users } = setup();
    const result = await handler.execute(
      new CreateUserCommand({
        email: "a@x.io",
        country: "USA",
        street: "1 Main St",
        postalCode: "12345",
      }),
    );
    const id = result.unwrap();
    const stored = (await users.findOne(UserSpecifications.withId(id))).unwrap();
    deepStrictEqual(stored?.address, { country: "USA", street: "1 Main St", postalCode: "12345" });
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["UserCreated"],
    );
  });

  it("stores a null address when any part is missing", async () => {
    const { handler, users } = setup();
    const id = (
      await handler.execute(new CreateUserCommand({ email: "a@x.io", country: "USA" }))
    ).unwrap();
    deepStrictEqual((await users.findOne(UserSpecifications.withId(id))).unwrap()?.address, null);
  });

  it("returns UserAlreadyExists for a duplicate email and emits nothing", async () => {
    const { events, handler } = setup();
    await handler.execute(new CreateUserCommand({ email: "a@x.io" }));
    const second = await handler.execute(new CreateUserCommand({ email: "a@x.io" }));
    deepStrictEqual(second.unwrapErr()._tag, "UserAlreadyExists");
    deepStrictEqual(events.dispatched().length, 1);
  });
});
