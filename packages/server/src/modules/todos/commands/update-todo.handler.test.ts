import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepositoryFake } from "../infrastructure/repositories/todos.repository-fake.js";
import { UpdateTodoCommand } from "./update-todo.command.js";
import { UpdateTodoHandler } from "./update-todo.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const otherOrg = OrganizationId.parse("33333333-3333-3333-3333-333333333333");
const todoId = TodoId.parse("44444444-4444-4444-4444-444444444444");

const setup = async () => {
  const todos = new TodosRepositoryFake();
  await todos.insertOne(
    TodoRootOps.create({ id: todoId, organizationId: orgId, title: "Buy milk", now: new Date() }),
  );
  return { todos, handler: new UpdateTodoHandler(todos, PassThroughUnitOfWork) };
};

describe("UpdateTodoHandler", () => {
  it("updates title and completed", async () => {
    const { handler } = await setup();
    const result = await handler.execute(
      new UpdateTodoCommand({
        todoId,
        organizationId: orgId,
        title: "Oat milk",
        completed: true,
        userId,
      }),
    );
    deepStrictEqual(result.unwrap().title, "Oat milk");
    deepStrictEqual(result.unwrap().completed, true);
  });

  it("reports TodoNotFound for another org's todo", async () => {
    const { handler } = await setup();
    const result = await handler.execute(
      new UpdateTodoCommand({
        todoId,
        organizationId: otherOrg,
        title: "x",
        completed: false,
        userId,
      }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "TodoNotFound");
  });
});
