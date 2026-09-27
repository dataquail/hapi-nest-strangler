import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepositoryLive } from "../infrastructure/repositories/todos.repository-live.js";
import { FindTodoOrganizationHandler } from "./find-todo-organization.handler.js";
import { FindTodoOrganizationQuery } from "./find-todo-organization.query.js";

const orgId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const otherOrgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.parse("33333333-3333-3333-3333-333333333333");
const unknownTodoId = TodoId.parse("44444444-4444-4444-4444-444444444444");

describe.sequential("FindTodoOrganizationHandler (integration)", () => {
  let db: Database;
  let handler: FindTodoOrganizationHandler;

  const seed = async () => {
    await db.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES
        (${orgId}, 'Owner', now(), now(), null),
        (${otherOrgId}, 'Other', now(), now(), null)
    `);
    const repo = new TodosRepositoryLive(db);
    (
      await repo.insertOne(
        TodoRootOps.create({
          id: todoId,
          organizationId: orgId,
          title: "Buy milk",
          now: new Date(),
        }),
      )
    ).unwrap();
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    handler = new FindTodoOrganizationHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "todos.todos", "organization.organizations");
    await seed();
  });

  it("returns the todo's organization when the ids match", async () => {
    const view = (
      await handler.execute(new FindTodoOrganizationQuery({ organizationId: orgId, todoId }))
    ).unwrap();
    deepStrictEqual(view, { organizationId: orgId });
  });

  // Tenant isolation: the query pins both ids, so a real todo reached through
  // another org's path reads as absent rather than resolving.
  it("returns null for a todo that lives in a different organization", async () => {
    const view = (
      await handler.execute(new FindTodoOrganizationQuery({ organizationId: otherOrgId, todoId }))
    ).unwrap();
    deepStrictEqual(view, null);
  });

  it("returns null for an unknown todo", async () => {
    const view = (
      await handler.execute(
        new FindTodoOrganizationQuery({ organizationId: orgId, todoId: unknownTodoId }),
      )
    ).unwrap();
    deepStrictEqual(view, null);
  });
});
