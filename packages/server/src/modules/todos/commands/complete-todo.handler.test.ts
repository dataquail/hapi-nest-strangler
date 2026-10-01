import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepositoryFake } from "../infrastructure/repositories/todos.repository-fake.js";
import { CompleteTodoCommand } from "./complete-todo.command.js";
import { CompleteTodoHandler } from "./complete-todo.handler.js";

const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.parse("44444444-4444-4444-4444-444444444444");

describe("CompleteTodoHandler", () => {
  it("marks the todo completed", async () => {
    const todos = new TodosRepositoryFake();
    await todos.insertOne(
      TodoRootOps.create({ id: todoId, organizationId: orgId, title: "Buy milk", now: new Date() }),
    );
    const handler = new CompleteTodoHandler(todos, PassThroughUnitOfWork);
    const result = await handler.execute(
      new CompleteTodoCommand({ todoId, organizationId: orgId }),
    );
    deepStrictEqual(result.unwrap().completed, true);
  });

  it("reports TodoNotFound for an unknown todo", async () => {
    const handler = new CompleteTodoHandler(new TodosRepositoryFake(), PassThroughUnitOfWork);
    const result = await handler.execute(
      new CompleteTodoCommand({ todoId, organizationId: orgId }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "TodoNotFound");
  });
});
