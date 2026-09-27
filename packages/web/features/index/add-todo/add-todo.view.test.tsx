import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TEST_ORG_ID } from "@/test/fixtures/todo";

import { AddTodo } from "./add-todo.view";
import type * as ViewModelModule from "./add-todo.view-model";
import { type AddTodoViewModel, EMPTY_FIELDS } from "./add-todo.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as AddTodoViewModel }));

vi.mock("./add-todo.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useAddTodoViewModel: () => viewModel.current,
}));

const renderAddTodo = (overrides: Partial<AddTodoViewModel> = {}) => {
  const stub: AddTodoViewModel = {
    fields: EMPTY_FIELDS,
    errors: null,
    visibleErrors: null,
    submitAttempted: false,
    isSubmitting: false,
    setTitle: vi.fn(),
    submit: vi.fn(),
    ...overrides,
  };
  viewModel.current = stub;
  return { ...render(<AddTodo orgId={TEST_ORG_ID} />), stub };
};

describe("AddTodo view", () => {
  it("renders the title held in the ViewModel", () => {
    renderAddTodo({ fields: { title: "Buy milk" } });
    expect(screen.getByTestId("add-todo-input")).toHaveValue("Buy milk");
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderAddTodo();

    await user.type(screen.getByTestId("add-todo-input"), "W");

    expect(stub.setTitle).toHaveBeenCalledWith("W");
  });

  it("shows no error before a submit attempt", () => {
    renderAddTodo({ errors: { title: "Required" } });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows the error once submission has been attempted with a blank title", () => {
    renderAddTodo({ submitAttempted: true, visibleErrors: { title: "Required" } });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("dispatches submit to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderAddTodo({ fields: { title: "Buy milk" } });

    await user.click(screen.getByTestId("add-todo-submit"));

    expect(stub.submit).toHaveBeenCalledTimes(1);
  });

  it("disables the button and shows a spinner while the request is in flight", () => {
    renderAddTodo({ isSubmitting: true });

    expect(screen.getByTestId("add-todo-submit")).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
