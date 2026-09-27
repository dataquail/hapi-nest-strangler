import { TodosContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";

import { makeTodo } from "../fixtures/todo";
import { fail, ok, typedHandler } from "../typed-handler";

const routes = TodosContract.Group.routes;

export const todosHandlers = {
  list: (todos: ReadonlyArray<TodosContract.Todo> = []) =>
    typedHandler(routes.get, () => ok(todos)),

  /** Echoes the submitted title back as a new todo. */
  create: (outcome: { readonly result: "success" | "Forbidden" } = { result: "success" }) =>
    typedHandler(routes.create, ({ payload }) =>
      outcome.result === "Forbidden"
        ? fail(HttpErrors.Forbidden, { message: "Not a member." })
        : ok(makeTodo({ title: payload.title })),
    ),

  /** Echoes the submitted state back. */
  update: (outcome: { readonly result: "success" | "TodoNotFoundError" } = { result: "success" }) =>
    typedHandler(routes.update, ({ path, payload }) =>
      outcome.result === "TodoNotFoundError"
        ? fail(TodosContract.TodoNotFoundError, { message: "Todo not found." })
        : ok(makeTodo({ id: path.id, title: payload.title, completed: payload.completed })),
    ),

  delete: (outcome: { readonly result: "success" | "TodoNotFoundError" } = { result: "success" }) =>
    typedHandler(routes.delete, () =>
      outcome.result === "TodoNotFoundError"
        ? fail(TodosContract.TodoNotFoundError, { message: "Todo not found." })
        : ok(undefined),
    ),
};
