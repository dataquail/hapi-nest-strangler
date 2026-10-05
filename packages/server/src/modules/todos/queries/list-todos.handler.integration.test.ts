import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepositoryLive } from "../infrastructure/repositories/todos.repository-live.js";
import { ListTodosHandler } from "./list-todos.handler.js";
import { ListTodosQuery } from "./list-todos.query.js";

const aliceId = TodoId.parse("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.parse("22222222-2222-2222-2222-222222222222");
const carolId = TodoId.parse("33333333-3333-3333-3333-333333333333");
const orgA = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const aliceTime = new Date("2025-01-01T00:00:00Z");
const bobTime = new Date("2025-02-01T00:00:00Z");
const carolTime = new Date("2025-03-01T00:00:00Z");

describe.sequential("ListTodosHandler (integration)", () => {
  let db: Database;
  let repo: TodosRepositoryLive;
  let handler: ListTodosHandler;

  const seed = async (id: TodoId, organizationId: OrganizationId, title: string, now: Date) => {
    (await repo.insertOne(TodoRootOps.create({ id, organizationId, title, now }))).unwrap();
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new TodosRepositoryLive(db);
    handler = new ListTodosHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "todos.todos");
  });

  it("returns only the requested org's rows, ordered by created_at desc", async () => {
    await seed(aliceId, orgA, "alice", aliceTime);
    await seed(bobId, orgA, "bob", bobTime);
    await seed(carolId, orgB, "carol-in-org-b", carolTime);

    const result = (await handler.execute(new ListTodosQuery({ organizationId: orgA }))).unwrap();
    deepStrictEqual(
      result.todos.map((t) => t.title),
      ["bob", "alice"],
    );
  });

  it("returns empty for an org with no todos", async () => {
    await seed(aliceId, orgA, "alice", aliceTime);
    const result = (await handler.execute(new ListTodosQuery({ organizationId: orgB }))).unwrap();
    deepStrictEqual(result.todos, []);
  });
});
