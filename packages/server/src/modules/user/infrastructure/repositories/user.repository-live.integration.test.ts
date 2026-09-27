import { deepStrictEqual, notStrictEqual, rejects } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { UserRepositoryLive } from "./user.repository-live.js";

const aliceId = UserId.parse("11111111-1111-1111-1111-111111111111");
const bobId = UserId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");
const later = new Date("2025-02-01T00:00:00Z");

const address = AddressValueObject.parse({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const alice = UserRootOps.create({ id: aliceId, email: "alice@example.com", address, now }).user;

describe.sequential("UserRepositoryLive (integration)", () => {
  let db: Database;
  let repo: UserRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new UserRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "user.users");
  });

  describe("insert", () => {
    it("persists the user and decodes it back via findOne(withId)", async () => {
      (await repo.insertOne(alice)).unwrap();
      const found = (await repo.findOne(UserSpecifications.withId(alice.id))).unwrap();
      if (found === null) throw new Error("expected stored user");
      deepStrictEqual(found.id, alice.id);
      deepStrictEqual(found.email, alice.email);
      if (found.address === null) throw new Error("expected a stored address");
      deepStrictEqual(found.address.country, "USA");
      deepStrictEqual(found.address.street, "123 Main St");
      deepStrictEqual(found.address.postalCode, "12345");
    });

    it("fails UserAlreadyExists on duplicate email (unique violation → domain error)", async () => {
      (await repo.insertOne(alice)).unwrap();
      const clashing = UserRootOps.create({ id: bobId, email: alice.email, address, now }).user;
      const result = await repo.insertOne(clashing);
      const error = result.unwrapErr();
      deepStrictEqual(error._tag, "UserAlreadyExists");
      if (error._tag === "UserAlreadyExists") deepStrictEqual(error.email, alice.email);
    });
  });

  describe("findOne", () => {
    it("returns null for an unknown id (absence is not an error)", async () => {
      deepStrictEqual((await repo.findOne(UserSpecifications.withId(aliceId))).unwrap(), null);
    });

    it("returns the user when the email matches", async () => {
      (await repo.insertOne(alice)).unwrap();
      const found = (
        await repo.findOne(UserSpecifications.withEmail("alice@example.com"))
      ).unwrap();
      deepStrictEqual(found?.id, alice.id);
    });

    it("returns null when no user has the email", async () => {
      deepStrictEqual(
        (await repo.findOne(UserSpecifications.withEmail("nobody@example.com"))).unwrap(),
        null,
      );
    });
  });

  describe("update", () => {
    it("overwrites address and updatedAt", async () => {
      (await repo.insertOne(alice)).unwrap();
      const { user: updated } = UserRootOps.updateAddress(alice, { country: "Canada", now: later });
      (await repo.updateOne(updated)).unwrap();
      const found = (await repo.findOne(UserSpecifications.withId(alice.id))).unwrap();
      if (found === null) throw new Error("expected stored user");
      deepStrictEqual(found.address?.country, "Canada");
      deepStrictEqual(found.updatedAt.toISOString(), later.toISOString());
    });

    it("fails UserNotFound when the user isn't stored", async () => {
      deepStrictEqual((await repo.updateOne(alice)).unwrapErr()._tag, "UserNotFound");
    });
  });

  describe("remove", () => {
    it("deletes the row", async () => {
      (await repo.insertOne(alice)).unwrap();
      (await repo.deleteOne(alice.id)).unwrap();
      deepStrictEqual((await repo.findOne(UserSpecifications.withId(alice.id))).unwrap(), null);
    });

    it("fails UserNotFound when the user isn't stored", async () => {
      deepStrictEqual((await repo.deleteOne(aliceId)).unwrapErr()._tag, "UserNotFound");
    });
  });

  describe("transaction", () => {
    it("commits inserts when the body succeeds", async () => {
      await db.withTransaction(async () => {
        (await repo.insertOne(alice)).unwrap();
      });
      notStrictEqual(
        (await repo.findOne(UserSpecifications.withEmail(alice.email))).unwrap(),
        null,
      );
    });

    it("rolls back inserts when the body fails (surfaces typed error)", async () => {
      await rejects(
        db.withTransaction(async () => {
          (await repo.insertOne(alice)).unwrap();
          throw new UserNotFound({ userId: bobId });
        }),
        (error: unknown) => error instanceof UserNotFound,
      );
      deepStrictEqual(
        (await repo.findOne(UserSpecifications.withEmail(alice.email))).unwrap(),
        null,
      );
    });
  });
});
