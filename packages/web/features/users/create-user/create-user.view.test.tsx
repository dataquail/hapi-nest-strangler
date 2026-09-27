import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateUser } from "./create-user.view";
import type * as ViewModelModule from "./create-user.view-model";
import { type CreateUserViewModel, EMPTY_FIELDS } from "./create-user.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as CreateUserViewModel }));

vi.mock("./create-user.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useCreateUserViewModel: () => viewModel.current,
}));

const FILLED = { email: "ada@example.com", country: "US", street: "2 B St", postalCode: "10002" };

const renderCreateUser = (overrides: Partial<CreateUserViewModel> = {}) => {
  const stub: CreateUserViewModel = {
    fields: EMPTY_FIELDS,
    errors: null,
    visibleErrors: null,
    submitAttempted: false,
    isSubmitting: false,
    setField: vi.fn(),
    setFields: vi.fn(),
    submit: vi.fn(),
    ...overrides,
  };
  viewModel.current = stub;
  return { ...render(<CreateUser />), stub };
};

describe("CreateUser view", () => {
  it("renders each field with the value held in the ViewModel", () => {
    renderCreateUser({ fields: FILLED });

    expect(screen.getByTestId("create-user-email")).toHaveValue("ada@example.com");
    expect(screen.getByTestId("create-user-country")).toHaveValue("US");
    expect(screen.getByTestId("create-user-street")).toHaveValue("2 B St");
    expect(screen.getByTestId("create-user-postal-code")).toHaveValue("10002");
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderCreateUser();

    await user.type(screen.getByTestId("create-user-country"), "G");

    expect(stub.setField).toHaveBeenCalledWith("country", "G");
  });

  it("shows no errors before a submit attempt", () => {
    renderCreateUser({ errors: { email: "Too short" } });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows one alert per invalid field once submission has been attempted", () => {
    renderCreateUser({
      submitAttempted: true,
      visibleErrors: { email: "e", country: "c", street: "s", postalCode: "p" },
    });
    expect(screen.getAllByRole("alert")).toHaveLength(4);
  });

  it("dispatches submit to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderCreateUser({ fields: FILLED });

    await user.click(screen.getByTestId("create-user-submit"));

    expect(stub.submit).toHaveBeenCalledTimes(1);
  });

  it("disables the button and says so while the request is in flight", () => {
    renderCreateUser({ isSubmitting: true });

    const button = screen.getByTestId("create-user-submit");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Creating…");
  });
});
