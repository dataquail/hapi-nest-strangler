import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateOrg } from "./create-org.view";
import type * as ViewModelModule from "./create-org.view-model";
import { type CreateOrgViewModel, EMPTY_FIELDS } from "./create-org.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as CreateOrgViewModel }));

vi.mock("./create-org.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useCreateOrgViewModel: () => viewModel.current,
}));

const renderCreateOrg = (overrides: Partial<CreateOrgViewModel> = {}) => {
  const stub: CreateOrgViewModel = {
    fields: EMPTY_FIELDS,
    errors: null,
    visibleErrors: null,
    submitAttempted: false,
    isSubmitting: false,
    setName: vi.fn(),
    submit: vi.fn(),
    ...overrides,
  };
  viewModel.current = stub;
  return { ...render(<CreateOrg />), stub };
};

describe("CreateOrg view", () => {
  it("renders the name held in the ViewModel", () => {
    renderCreateOrg({ fields: { name: "Acme Inc." } });
    expect(screen.getByTestId("create-org-name")).toHaveValue("Acme Inc.");
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderCreateOrg();

    await user.type(screen.getByTestId("create-org-name"), "A");

    expect(stub.setName).toHaveBeenCalledWith("A");
  });

  it("shows no error before a submit attempt", () => {
    renderCreateOrg({ errors: { name: "Required" } });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows the error once submission has been attempted with a blank name", () => {
    renderCreateOrg({ submitAttempted: true, visibleErrors: { name: "Required" } });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("dispatches submit to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderCreateOrg({ fields: { name: "Acme Inc." } });

    await user.click(screen.getByTestId("create-org-submit"));

    expect(stub.submit).toHaveBeenCalledTimes(1);
  });

  it("disables the button and says so while the request is in flight", () => {
    renderCreateOrg({ isSubmitting: true });

    const button = screen.getByTestId("create-org-submit");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Creating…");
  });
});
