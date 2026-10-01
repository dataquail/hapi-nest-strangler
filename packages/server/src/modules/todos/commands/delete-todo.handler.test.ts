import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodoSpecifications } from "../domain/todo/todos.specification.js";
import { TodosRepositoryFake } from "../infrastructure/repositories/todos.repository-fake.js";
import { DeleteTodoCommand } from "./delete-todo.command.js";
import { DeleteTodoHandler } from "./delete-todo.handler.js";

const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.parse("44444444-4444-4444-4444-444444444444");

describe("DeleteTodoHandler", () => {
  it("deletes the todo", async () => {
    const todos = new TodosRepositoryFake();
    await todos.insertOne(
      TodoRootOps.create({ id: todoId, organizationId: orgId, title: "Buy milk", now: new Date() }),
    );
    const handler = new DeleteTodoHandler(todos, PassThroughUnitOfWork);
    deepStrictEqual(
      (await handler.execute(new DeleteTodoCommand({ todoId, organizationId: orgId }))).isOk(),
      true,
    );
    deepStrictEqual(
      (
        await todos.findOne(
          Spec.and(TodoSpecifications.withId(todoId), TodoSpecifications.forOrganization(orgId)),
        )
      ).unwrap(),
      null,
    );
  });

  it("reports TodoNotFound for an unknown todo", async () => {
    const handler = new DeleteTodoHandler(new TodosRepositoryFake(), PassThroughUnitOfWork);
    const result = await handler.execute(new DeleteTodoCommand({ todoId, organizationId: orgId }));
    deepStrictEqual(result.unwrapErr()._tag, "TodoNotFound");
  });
});
