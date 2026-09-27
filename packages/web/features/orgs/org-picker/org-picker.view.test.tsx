import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";

import { OrgPicker } from "./org-picker.view";
import type { OrgPickerViewModel } from "./org-picker.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as OrgPickerViewModel }));

vi.mock("./org-picker.view-model", () => ({ useOrgPickerViewModel: () => viewModel.current }));

const renderPicker = (orgs: ReadonlyArray<ReturnType<typeof makeMyOrganization>>) => {
  viewModel.current = {
    cards: orgs.map((org) => ({ id: org.id, name: org.name, href: `/orgs/${org.id}` })),
    isEmpty: orgs.length === 0,
  };
  return render(<OrgPicker />);
};

describe("OrgPicker view", () => {
  it("renders one card per organization, linking into it", () => {
    renderPicker([
      makeMyOrganization({ name: "Org A" }),
      makeMyOrganization({ id: ORG_B_ID, name: "Org B" }),
    ]);

    const picker = screen.getByTestId("org-picker");
    const links = within(picker).getAllByTestId("org-picker-item");
    expect(links).toHaveLength(2);
    expect(within(picker).getByText("Org A")).toBeInTheDocument();
    expect(links[1]).toHaveAttribute("href", `/orgs/${ORG_B_ID}`);
  });

  it("shows the empty state instead of a grid when the caller belongs to nothing", () => {
    renderPicker([]);

    expect(screen.getByText(/don't belong to any organizations yet/)).toBeInTheDocument();
    expect(screen.queryByTestId("org-picker")).not.toBeInTheDocument();
  });
});
