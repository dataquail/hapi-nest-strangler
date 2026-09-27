import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  makeOrganization,
  makePaginatedOrganizations,
  ORG_B_ID,
} from "@/test/fixtures/organization";

import { OrgsList } from "./orgs-list.view";
import type * as ViewModelModule from "./orgs-list.view-model";
import { computeOrgsListView, type OrgsListViewModel } from "./orgs-list.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as OrgsListViewModel }));

vi.mock("./orgs-list.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useOrgsListViewModel: () => viewModel.current,
}));

const renderList = (page: ReturnType<typeof makePaginatedOrganizations>) => {
  const stub: OrgsListViewModel = {
    ...computeOrgsListView({ page, currentPage: page.page, includeDeleted: false }),
    changePage: vi.fn(),
    toggleIncludeDeleted: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
  };
  viewModel.current = stub;
  return { ...render(<OrgsList />), stub };
};

describe("OrgsList view", () => {
  it("links an active row and leaves a deleted one as plain text", () => {
    renderList(
      makePaginatedOrganizations({
        organizations: [
          makeOrganization({ name: "Live Org" }),
          makeOrganization({
            id: ORG_B_ID,
            name: "Dead Org",
            deletedAt: makeOrganization().createdAt,
          }),
        ],
        total: 2,
      }),
    );

    const list = screen.getByTestId("admin-orgs-list");
    expect(within(list).getAllByTestId("admin-orgs-row-link")).toHaveLength(1);
    expect(within(list).getByText("Live Org")).toBeInTheDocument();
    expect(within(list).getByText("Dead Org")).toBeInTheDocument();
  });

  it("offers Delete on an active row and Restore on a deleted one", () => {
    renderList(
      makePaginatedOrganizations({
        organizations: [
          makeOrganization(),
          makeOrganization({ id: ORG_B_ID, deletedAt: makeOrganization().createdAt }),
        ],
        total: 2,
      }),
    );

    expect(screen.getAllByTestId("admin-orgs-delete")).toHaveLength(1);
    expect(screen.getAllByTestId("admin-orgs-restore")).toHaveLength(1);
  });

  it("shows the empty state instead of a list when there are no organizations", () => {
    renderList(makePaginatedOrganizations({ organizations: [], total: 0 }));

    expect(screen.getByText("No organizations.")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-orgs-list")).not.toBeInTheDocument();
  });

  it("dispatches the deleted-filter toggle to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderList(makePaginatedOrganizations({ total: 1 }));
    expect(screen.getByTestId("orgs-toggle-deleted")).toHaveTextContent("Show deleted");

    await user.click(screen.getByTestId("orgs-toggle-deleted"));

    expect(stub.toggleIncludeDeleted).toHaveBeenCalledTimes(1);
  });

  it("dispatches a page change to the ViewModel", async () => {
    const user = userEvent.setup();
    const { stub } = renderList(makePaginatedOrganizations({ total: 25 }));

    await user.click(screen.getByTestId("pagination-next"));

    expect(stub.changePage).toHaveBeenCalledWith("next");
  });
});
