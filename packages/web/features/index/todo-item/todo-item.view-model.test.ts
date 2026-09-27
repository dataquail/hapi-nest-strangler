import { TodosContract } from "@org/contracts/api/Contracts";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { todosHandlers } from "@/test/handlers/todos";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { useTodoItemViewModel } from "./todo-item.view-model";

const announced = () => notificationStore.get() !== null;

describe("todo item ViewModel", () => {
  it("sends the todo back with completion inverted, keeping its title", async () => {
    const sent: Array<TodosContract.UpdateTodoPayload> = [];
    server.use(
      typedHandler(TodosContract.Group.routes.update, ({ path, payload }) => {
        sent.push(payload);
        return ok(makeTodo({ id: path.id, title: payload.title, completed: payload.completed }));
      }),
    );

    const harness = renderViewModel(() =>
      useTodoItemViewModel(TEST_ORG_ID, makeTodo({ title: "Buy milk", completed: false })),
    );
    act(() => {
      harness.result.current.toggle();
    });
    await harness.settle(announced);

    expect(sent).toEqual([{ title: "Buy milk", completed: true }]);
  });

  it("inverts back the other way, so a completed todo can be reopened", async () => {
    const sent: Array<boolean> = [];
    server.use(
      typedHandler(TodosContract.Group.routes.update, ({ path, payload }) => {
        sent.push(payload.completed);
        return ok(makeTodo({ id: path.id, completed: payload.completed }));
      }),
    );

    const harness = renderViewModel(() =>
      useTodoItemViewModel(TEST_ORG_ID, makeTodo({ completed: true })),
    );
    act(() => {
      harness.result.current.toggle();
    });
    await harness.settle(announced);

    expect(sent).toEqual([false]);
  });

  it("announces a successful toggle", async () => {
    server.use(todosHandlers.update());

    const harness = renderViewModel(() => useTodoItemViewModel(TEST_ORG_ID, makeTodo()));
    act(() => {
      harness.result.current.toggle();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({ kind: "success", message: "Todo updated!" });
  });

  it("surfaces the server's message when the todo is already gone", async () => {
    server.use(todosHandlers.update({ result: "TodoNotFoundError" }));

    const harness = renderViewModel(() => useTodoItemViewModel(TEST_ORG_ID, makeTodo()));
    act(() => {
      harness.result.current.toggle();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({ kind: "error", message: "Todo not found." });
  });

  it("deletes by id and announces it", async () => {
    const deleted: Array<string> = [];
    server.use(
      typedHandler(TodosContract.Group.routes.delete, ({ path }) => {
        deleted.push(path.id);
        return ok(undefined);
      }),
    );

    const todo = makeTodo();
    const harness = renderViewModel(() => useTodoItemViewModel(TEST_ORG_ID, todo));
    act(() => {
      harness.result.current.remove();
    });
    await harness.settle(announced);

    expect(deleted).toEqual([todo.id]);
    expect(notificationStore.get()).toMatchObject({ kind: "success", message: "Todo deleted!" });
  });

  it("surfaces a failed delete rather than claiming success", async () => {
    server.use(todosHandlers.delete({ result: "TodoNotFoundError" }));

    const harness = renderViewModel(() => useTodoItemViewModel(TEST_ORG_ID, makeTodo()));
    act(() => {
      harness.result.current.remove();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({ kind: "error", message: "Todo not found." });
  });
});
