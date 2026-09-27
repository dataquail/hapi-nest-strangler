import { TodosContract } from "@org/contracts/api/Contracts";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { todosHandlers } from "@/test/handlers/todos";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { useAddTodoViewModel } from "./add-todo.view-model";

describe("add todo ViewModel", () => {
  it("rejects a blank title and accepts a filled one", () => {
    const harness = renderViewModel(() => useAddTodoViewModel(TEST_ORG_ID));
    expect(harness.result.current.errors?.title).toBeTypeOf("string");

    act(() => {
      harness.result.current.setTitle("Buy milk");
    });
    expect(harness.result.current.errors).toBeNull();
  });

  it("keeps the error hidden until the first submit attempt", () => {
    const harness = renderViewModel(() => useAddTodoViewModel(TEST_ORG_ID));
    expect(harness.result.current.visibleErrors).toBeNull();

    act(() => {
      harness.result.current.submit();
    });

    expect(harness.result.current.submitAttempted).toBe(true);
    expect(harness.result.current.visibleErrors?.title).toBeTypeOf("string");
  });

  it("does not call the API, or claim success, when the title is blank", () => {
    // No handler registered: MSW errors on any unhandled request.
    const harness = renderViewModel(() => useAddTodoViewModel(TEST_ORG_ID));

    act(() => {
      harness.result.current.submit();
    });

    expect(notificationStore.get()).toBeNull();
  });

  it("posts the title to the org, announces it, and clears the field", async () => {
    const posted: Array<{ orgId: string; title: string }> = [];
    server.use(
      typedHandler(TodosContract.Group.routes.create, ({ path, payload }) => {
        posted.push({ orgId: path.orgId, title: payload.title });
        return ok(makeTodo({ title: payload.title }));
      }),
    );

    const harness = renderViewModel(() => useAddTodoViewModel(TEST_ORG_ID));
    act(() => {
      harness.result.current.setTitle("Buy milk");
    });
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle((value) => value.fields.title === "");

    expect(posted).toEqual([{ orgId: TEST_ORG_ID, title: "Buy milk" }]);
    expect(notificationStore.get()).toMatchObject({ kind: "success", message: "Todo created!" });
    expect(harness.result.current.submitAttempted).toBe(false);
  });

  it("keeps what the user typed when the server refuses", async () => {
    server.use(todosHandlers.create({ result: "Forbidden" }));

    const harness = renderViewModel(() => useAddTodoViewModel(TEST_ORG_ID));
    act(() => {
      harness.result.current.setTitle("Buy milk");
    });
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle(() => notificationStore.get() !== null);

    expect(notificationStore.get()).toMatchObject({ kind: "error" });
    expect(harness.result.current.fields).toEqual({ title: "Buy milk" });
  });
});
