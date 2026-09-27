import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";

import { TodoItem } from "./todo-item.view";
import type { TodoItemViewModel } from "./todo-item.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as TodoItemViewModel }));

vi.mock("./todo-item.view-model", () => ({ useTodoItemViewModel: () => viewModel.current }));

const renderItem = (todo = makeTodo({ title: "Buy milk" })) => {
  const stub: TodoItemViewModel = {
    toggle: vi.fn(),
    remove: vi.fn(),
    isToggling: false,
    isRemoving: false,
  };
  viewModel.current = stub;
  return { ...render(<TodoItem orgId={TEST_ORG_ID} todo={todo} />), stub };
};

describe("TodoItem view", () => {
  it("labels the checkbox with the todo's title and reflects its state", () => {
    renderItem();
    expect(screen.getByRole("checkbox", { name: "Buy milk" })).not.toBeChecked();
  });

  it("shows a completed todo as checked", () => {
    renderItem(makeTodo({ title: "Buy milk", completed: true }));
    expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeChecked();
  });

  it("dispatches a toggle when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    const { stub } = renderItem();

    await user.click(screen.getByRole("checkbox", { name: "Buy milk" }));

    expect(stub.toggle).toHaveBeenCalledTimes(1);
  });

  it("dispatches a delete when the delete control is clicked", async () => {
    const user = userEvent.setup();
    const { stub } = renderItem();

    await user.click(screen.getByTestId("todo-item-delete"));

    expect(stub.remove).toHaveBeenCalledTimes(1);
  });
});
