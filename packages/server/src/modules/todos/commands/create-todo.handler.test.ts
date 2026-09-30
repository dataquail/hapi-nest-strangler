import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { TodoSpecifications } from "../domain/todo/todos.specification.js";
import { TodosRepositoryFake } from "../infrastructure/repositories/todos.repository-fake.js";
import { CreateTodoCommand } from "./create-todo.command.js";
import { CreateTodoHandler } from "./create-todo.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

describe("CreateTodoHandler", () => {
  it("inserts a todo scoped to the org with completed=false and returns it", async () => {
    const todos = new TodosRepositoryFake();
    const handler = new CreateTodoHandler(todos, PassThroughUnitOfWork);
    const todo = (
      await handler.execute(
        new CreateTodoCommand({ title: "Buy milk", organizationId: orgId, userId }),
      )
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
      await handler.execute(new CreateTodoCommand({ title: "A", organizationId: orgId, userId }))
    ).unwrap();
    const b = (
      await handler.execute(new CreateTodoCommand({ title: "B", organizationId: orgId, userId }))
    ).unwrap();
    deepStrictEqual(a.id === b.id, false);
  });
});
