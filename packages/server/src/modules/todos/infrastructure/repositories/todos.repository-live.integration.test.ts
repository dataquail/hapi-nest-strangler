import { deepStrictEqual, rejects } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.js";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { TodosRepositoryLive } from "./todos.repository-live.js";

const aliceId = TodoId.parse("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.parse("22222222-2222-2222-2222-222222222222");
const orgA = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = new Date("2025-01-01T00:00:00Z");
const later = new Date("2025-02-01T00:00:00Z");

const buyMilk = TodoRootOps.create({ id: aliceId, organizationId: orgA, title: "Buy milk", now });

const byOrgAndId = (organizationId: OrganizationId, id: TodoId) =>
  Spec.and(TodoSpecifications.withId(id), TodoSpecifications.forOrganization(organizationId));

describe.sequential("TodosRepositoryLive (integration)", () => {
  let db: Database;
  let repo: TodosRepositoryLive;

  // todos.todos.organization_id FKs to organization.organizations(id); both
  // orgs are seeded by raw SQL since this module may not reach the org module.
  const seedOrgs = async () => {
    for (const [id, name] of [
      [orgA, "Acme"],
      [orgB, "Beta"],
    ] as const) {
      await db.exec(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${id}, ${name}, now(), now(), null)
      `);
    }
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new TodosRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "todos.todos", "organization.organizations");
    await seedOrgs();
  });

  describe("insert", () => {
    it("persists the todo with its org and decodes it back via findOne", async () => {
      (await repo.insertOne(buyMilk)).unwrap();
      const found = (await repo.findOne(byOrgAndId(orgA, buyMilk.id))).unwrap();
      if (found === null) throw new Error("expected stored todo");
      deepStrictEqual(found.id, buyMilk.id);
      deepStrictEqual(found.organizationId, orgA);
      deepStrictEqual(found.title, buyMilk.title);
      deepStrictEqual(found.completed, false);
    });
  });

  describe("findOne", () => {
    it("returns null for an unknown id", async () => {
      deepStrictEqual((await repo.findOne(byOrgAndId(orgA, bobId))).unwrap(), null);
    });

    it("returns null when the todo belongs to another org (tenant isolation)", async () => {
      (await repo.insertOne(buyMilk)).unwrap();
      deepStrictEqual((await repo.findOne(byOrgAndId(orgB, buyMilk.id))).unwrap(), null);
    });
  });

  describe("update", () => {
    it("overwrites title/completed and updatedAt", async () => {
      (await repo.insertOne(buyMilk)).unwrap();
      const completed = TodoRootOps.update(buyMilk, {
        title: "Buy oat milk",
        completed: true,
        now: later,
      });
      (await repo.updateOne(completed)).unwrap();
      const found = (await repo.findOne(byOrgAndId(orgA, buyMilk.id))).unwrap();
      if (found === null) throw new Error("expected stored todo");
      deepStrictEqual(found.title, "Buy oat milk");
      deepStrictEqual(found.completed, true);
      deepStrictEqual(found.updatedAt.toISOString(), later.toISOString());
    });

    it("fails TodoNotFound when the todo isn't stored", async () => {
      deepStrictEqual((await repo.updateOne(buyMilk)).unwrapErr()._tag, "TodoNotFound");
    });
  });

  describe("remove", () => {
    it("deletes the row", async () => {
      (await repo.insertOne(buyMilk)).unwrap();
      (await repo.deleteOne(orgA, buyMilk.id)).unwrap();
      deepStrictEqual((await repo.findOne(byOrgAndId(orgA, buyMilk.id))).unwrap(), null);
    });

    it("fails TodoNotFound (and leaves the row) when removing from the wrong org", async () => {
      (await repo.insertOne(buyMilk)).unwrap();
      deepStrictEqual((await repo.deleteOne(orgB, buyMilk.id)).unwrapErr()._tag, "TodoNotFound");
      const found = (await repo.findOne(byOrgAndId(orgA, buyMilk.id))).unwrap();
      deepStrictEqual(found?.id, buyMilk.id);
    });

    it("fails TodoNotFound when the todo isn't stored", async () => {
      deepStrictEqual((await repo.deleteOne(orgA, bobId)).unwrapErr()._tag, "TodoNotFound");
    });
  });

  describe("transaction", () => {
    it("rolls back inserts when the body fails (surfaces typed error)", async () => {
      await rejects(
        db.withTransaction(async () => {
          (await repo.insertOne(buyMilk)).unwrap();
          throw new TodoNotFound({ todoId: bobId });
        }),
        (error: unknown) => error instanceof TodoNotFound,
      );
      deepStrictEqual((await repo.findOne(byOrgAndId(orgA, buyMilk.id))).unwrap(), null);
    });
  });
});
