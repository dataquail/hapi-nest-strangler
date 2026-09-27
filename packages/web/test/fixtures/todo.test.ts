import { TodosContract } from "@org/contracts/api/Contracts";
import { describe, expect, it } from "vitest";

import { makeCreateTodoPayload, makeTodo } from "./todo";

describe("todo fixtures", () => {
  it("makeTodo() parses through TodosContract.Todo", () => {
    expect(TodosContract.Todo.parse(makeTodo())).toBeDefined();
  });

  it("makeTodo() honors overrides", () => {
    expect(makeTodo({ completed: true }).completed).toBe(true);
  });

  it("makeCreateTodoPayload() parses through TodosContract.CreateTodoPayload", () => {
    expect(TodosContract.CreateTodoPayload.parse(makeCreateTodoPayload())).toBeDefined();
  });
});
