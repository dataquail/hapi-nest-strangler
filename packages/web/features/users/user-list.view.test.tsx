// A View is tested by injecting its ViewModel's output: the stub states the
// left-hand side, and the calls it receives after an interaction check the
// right-hand side. No server, no fetch, no ViewModel derivation in between.

import { UserId } from "@org/contracts/EntityIds";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Schemas } from "@/services/api/types";
import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";

import { UserList } from "./user-list.view";
import type * as ViewModelModule from "./user-list.view-model";
import { computePaginationView, PAGE_SIZE, type UserListViewModel } from "./user-list.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as UserListViewModel }));

vi.mock("./user-list.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useUserListViewModel: () => viewModel.current,
}));

const renderUserList = (page: Schemas["PaginatedUsers"]) => {
  const changePage = vi.fn();
  viewModel.current = {
    users: page.users,
    page: page.page,
    pagination: computePaginationView({
      currentPage: page.page,
      pageSize: PAGE_SIZE,
      total: page.total,
    }),
    changePage,
  };
  return { ...render(<UserList />), changePage };
};

describe("UserList view", () => {
  it("renders one row per user, with email and address", () => {
    renderUserList(
      makePaginatedUsers({
        users: [
          makeUser({ email: "ada@example.com" }),
          makeUser({
            id: UserId.parse("22222222-2222-2222-2222-222222222222"),
            email: "grace@example.com",
          }),
        ],
        total: 2,
      }),
    );

    const list = screen.getByTestId("user-list");
    expect(within(list).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(list).getByText("grace@example.com")).toBeInTheDocument();
    expect(within(list).getAllByText("1 A St, 10001 US")).toHaveLength(2);
  });

  it("says so when a user has no address on file", () => {
    renderUserList(makePaginatedUsers({ users: [makeUser({ address: null })], total: 1 }));
    expect(screen.getByText("No address on file")).toBeInTheDocument();
  });

  it("shows the empty state instead of a list when there are no users", () => {
    renderUserList(makePaginatedUsers({ users: [], total: 0 }));
    expect(screen.getByText("No users yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("user-list")).not.toBeInTheDocument();
  });

  it("reports the page position", () => {
    renderUserList(makePaginatedUsers({ users: [makeUser()], total: 25 }));
    expect(screen.getByText(/Page 1 of 3 · 25 total/)).toBeInTheDocument();
  });

  it("disables previous on the first page and enables next when more pages exist", () => {
    renderUserList(makePaginatedUsers({ users: [makeUser()], total: 25 }));
    expect(screen.getByTestId("pagination-previous")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).toBeEnabled();
  });

  it("dispatches a page change to the ViewModel when next is clicked", async () => {
    const user = userEvent.setup();
    const { changePage } = renderUserList(makePaginatedUsers({ users: [makeUser()], total: 25 }));

    await user.click(screen.getByTestId("pagination-next"));

    expect(changePage).toHaveBeenCalledWith("next");
  });
});
