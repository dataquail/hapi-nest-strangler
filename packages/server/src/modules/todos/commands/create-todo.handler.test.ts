import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoSpecifications } from "../domain/todo/todos.specification.js";
import { TodosRepositoryFake } from "../infrastructure/repositories/todos.repository-fake.js";
import { CreateTodoCommand } from "./create-todo.command.js";
import { CreateTodoHandler } from "./create-todo.handler.js";

const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

describe("CreateTodoHandler", () => {
  it("inserts a todo scoped to the org with completed=false and returns it", async () => {
    const todos = new TodosRepositoryFake();
    const handler = new CreateTodoHandler(todos, PassThroughUnitOfWork);
    const todo = (
      await handler.execute(new CreateTodoCommand({ title: "Buy milk", organizationId: orgId }))
    ).unwrap();
    deepStrictEqual(todo.title, "Buy milk");
    deepStrictEqual(todo.completed, false);
    deepStrictEqual(todo.organizationId, orgId);
    const stored = (
      await todos.findOne(
        Spec.and(TodoSpecifications.withId(todo.id), TodoSpecifications.forOrganization(orgId)),
      )
    ).unwrap();
    deepStrictEqual(stored?.title, "Buy milk");
  });

  it("each call gets a unique id", async () => {
    const handler = new CreateTodoHandler(new TodosRepositoryFake(), PassThroughUnitOfWork);
    const a = (
      await handler.execute(new CreateTodoCommand({ title: "A", organizationId: orgId }))
    ).unwrap();
    const b = (
      await handler.execute(new CreateTodoCommand({ title: "B", organizationId: orgId }))
    ).unwrap();
    deepStrictEqual(a.id === b.id, false);
  });

  it("keeps the id it is given and refuses a second insert under it", async () => {
    const handler = new CreateTodoHandler(new TodosRepositoryFake(), PassThroughUnitOfWork);
    const id = TodoId.parse("33333333-3333-3333-3333-333333333333");
    const first = await handler.execute(
      new CreateTodoCommand({ id, title: "Mirrored", organizationId: orgId }),
    );
    deepStrictEqual(first.unwrap().id, id);
    const again = await handler.execute(
      new CreateTodoCommand({ id, title: "Mirrored again", organizationId: orgId }),
    );
    deepStrictEqual(again.unwrapErr()._tag, "TodoAlreadyExists");
  });
});
