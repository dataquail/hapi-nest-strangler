import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { UserRootOps } from "../domain/user/user.root-ops.js";
import { UserSpecifications } from "../domain/user/user.specification.js";
import { UserRepositoryFake } from "../infrastructure/repositories/user.repository-fake.js";
import { DeleteUserCommand } from "./delete-user.command.js";
import { DeleteUserHandler } from "./delete-user.handler.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");

const setup = () => {
  const users = new UserRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return { users, events, handler: new DeleteUserHandler(users, events, unitOfWork) };
};

describe("DeleteUserHandler", () => {
  it("deletes an existing user and emits UserDeleted", async () => {
    const { events, handler, users } = setup();
    await users.insertOne(
      UserRootOps.create({ id: alice, email: "a@x.io", address: null, now: new Date() }).user,
    );
    deepStrictEqual((await handler.execute(new DeleteUserCommand({ userId: alice }))).isOk(), true);
    deepStrictEqual((await users.findOne(UserSpecifications.withId(alice))).unwrap(), null);
    deepStrictEqual(events.dispatched(), [{ _tag: "UserDeleted", userId: alice }]);
  });

  it("returns UserNotFound for an unknown user", async () => {
    const { handler } = setup();
    deepStrictEqual(
      (await handler.execute(new DeleteUserCommand({ userId: alice }))).unwrapErr()._tag,
      "UserNotFound",
    );
  });
});
