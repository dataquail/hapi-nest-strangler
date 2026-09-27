import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";

import { OrgSwitcher } from "./org-switcher.view";
import type * as ViewModelModule from "./org-switcher.view-model";
import { computeOrgSwitcherView, type OrgSwitcherViewModel } from "./org-switcher.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as OrgSwitcherViewModel }));

vi.mock("./org-switcher.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useOrgSwitcherViewModel: () => viewModel.current,
}));

const renderSwitcher = (
  orgs: ReadonlyArray<ReturnType<typeof makeMyOrganization>>,
  pathname = "/",
) => {
  const stub: OrgSwitcherViewModel = {
    ...computeOrgSwitcherView({ orgs, pathname }),
    selectOrg: vi.fn(),
    createNew: vi.fn(),
  };
  viewModel.current = stub;
  return { ...render(<OrgSwitcher />), stub };
};

describe("OrgSwitcher view", () => {
  it("renders nothing when the caller belongs to no organizations", () => {
    renderSwitcher([]);
    expect(screen.queryByTestId("org-switcher")).not.toBeInTheDocument();
  });

  it("shows the active organization's name", () => {
    renderSwitcher(
      [makeMyOrganization({ name: "Org A" }), makeMyOrganization({ id: ORG_B_ID, name: "Org B" })],
      `/orgs/${ORG_B_ID}`,
    );
    expect(screen.getByTestId("org-switcher")).toHaveTextContent("Org B");
  });

  it("dispatches the create-new affordance to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderSwitcher([makeMyOrganization()]);

    await user.click(screen.getByTestId("org-switcher-create-new"));

    expect(stub.createNew).toHaveBeenCalledTimes(1);
  });
});
