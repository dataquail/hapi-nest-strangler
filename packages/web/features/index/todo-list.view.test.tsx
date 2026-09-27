import { TodoId } from "@org/contracts/EntityIds";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Schemas } from "@/services/api/types";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";

import { TodoList } from "./todo-list.view";
import type { TodoListViewModel } from "./todo-list.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as TodoListViewModel }));

vi.mock("./todo-list.view-model", () => ({ useTodoListViewModel: () => viewModel.current }));
vi.mock("./todo-item/todo-item.view-model", () => ({
  useTodoItemViewModel: () => ({
    toggle: vi.fn(),
    remove: vi.fn(),
    isToggling: false,
    isRemoving: false,
  }),
}));

const renderList = (todos: ReadonlyArray<Schemas["Todo"]>) => {
  viewModel.current = { todos, isEmpty: todos.length === 0 };
  return render(<TodoList orgId={TEST_ORG_ID} />);
};

describe("TodoList view", () => {
  it("renders one row per todo", () => {
    renderList([
      makeTodo({ title: "Buy milk" }),
      makeTodo({ id: TodoId.parse("66666666-6666-6666-6666-666666666666"), title: "Walk the dog" }),
    ]);

    const list = screen.getByTestId("todo-list");
    expect(within(list).getAllByTestId("todo-item")).toHaveLength(2);
    expect(within(list).getByText("Buy milk")).toBeInTheDocument();
    expect(within(list).getByText("Walk the dog")).toBeInTheDocument();
  });

  it("shows the empty state instead of a list when the org has no todos", () => {
    renderList([]);

    expect(screen.getByText("No tasks yet. Add one above!")).toBeInTheDocument();
    expect(screen.queryByTestId("todo-list")).not.toBeInTheDocument();
  });
});
