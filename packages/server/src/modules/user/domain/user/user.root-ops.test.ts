import { deepStrictEqual, throws } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { UserRootOps } from "./user.root-ops.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2025-01-01T00:00:00Z");
const later = new Date("2025-02-01T00:00:00Z");
const address = { country: "USA", street: "1 Main St", postalCode: "12345" };

describe("UserRootOps.create", () => {
  it("builds the user and emits UserCreated with the address", () => {
    const { events, user } = UserRootOps.create({ id: alice, email: "a@x.io", address, now });
    deepStrictEqual(user.createdAt, now);
    deepStrictEqual(events, [{ _tag: "UserCreated", userId: alice, email: "a@x.io", address }]);
  });

  it("accepts a user with no address", () => {
    const { user } = UserRootOps.create({ id: alice, email: "a@x.io", address: null, now });
    deepStrictEqual(user.address, null);
  });
});

describe("UserRootOps.updateAddress", () => {
  it("merges the partial address, stamps updatedAt and emits UserAddressUpdated", () => {
    const { user } = UserRootOps.create({ id: alice, email: "a@x.io", address, now });
    const outcome = UserRootOps.updateAddress(user, { street: "2 Side St", now: later });
    deepStrictEqual(outcome.user.address, { ...address, street: "2 Side St" });
    deepStrictEqual(outcome.user.updatedAt, later);
    deepStrictEqual(outcome.events[0]?._tag, "UserAddressUpdated");
  });

  it("enforces the address invariants", () => {
    const { user } = UserRootOps.create({ id: alice, email: "a@x.io", address: null, now });
    throws(() => UserRootOps.updateAddress(user, { now: later }));
  });
});

describe("UserRootOps.markDeleted", () => {
  it("emits UserDeleted and leaves the user untouched", () => {
    const { user } = UserRootOps.create({ id: alice, email: "a@x.io", address, now });
    const outcome = UserRootOps.markDeleted(user);
    deepStrictEqual(outcome.user, user);
    deepStrictEqual(outcome.events, [{ _tag: "UserDeleted", userId: alice }]);
  });
});
