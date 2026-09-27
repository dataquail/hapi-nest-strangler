import { UserContract } from "@org/contracts/api/Contracts";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { computePaginationView, PAGE_SIZE, useUserListViewModel } from "./user-list.view-model";

describe("computePaginationView", () => {
  it("reports a single page and a zero range for an empty set", () => {
    expect(computePaginationView({ currentPage: 1, pageSize: 10, total: 0 })).toMatchObject({
      page: 1,
      totalPages: 1,
      isEmpty: true,
      hasPrevious: false,
      hasNext: false,
      displayedRange: { from: 0, to: 0 },
    });
  });

  it("clamps a page beyond the end back to the last page", () => {
    const view = computePaginationView({ currentPage: 99, pageSize: 10, total: 25 });
    expect(view.page).toBe(3);
    expect(view.hasNext).toBe(false);
    expect(view.displayedRange).toEqual({ from: 21, to: 25 });
  });

  it("clamps a page below one back to the first page", () => {
    expect(computePaginationView({ currentPage: 0, pageSize: 10, total: 25 }).page).toBe(1);
  });

  it("treats a non-positive page size as one, rather than dividing by zero", () => {
    const view = computePaginationView({ currentPage: 1, pageSize: 0, total: 3 });
    expect(view.pageSize).toBe(1);
    expect(view.totalPages).toBe(3);
  });
});

describe("user list ViewModel", () => {
  it("derives pagination from the fetched total", async () => {
    server.use(usersHandlers.list(makePaginatedUsers({ users: [makeUser()], total: 25 })));

    const harness = renderViewModel(useUserListViewModel);
    const view = await harness.settle(() => true);

    expect(view.pagination).toMatchObject({
      page: 1,
      pageSize: PAGE_SIZE,
      total: 25,
      totalPages: 3,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it("refetches the newly selected page from the server", async () => {
    const requestedPages: Array<number> = [];
    server.use(
      typedHandler(UserContract.Group.routes.find, ({ urlParams }) => {
        requestedPages.push(urlParams.page);
        return ok(makePaginatedUsers({ users: [makeUser()], page: urlParams.page, total: 25 }));
      }),
    );

    const harness = renderViewModel(useUserListViewModel);
    await harness.settle(() => true);
    expect(requestedPages).toEqual([1]);

    act(() => {
      harness.result.current.changePage("next");
    });
    const view = await harness.settle((value) => value.pagination.page === 2);

    expect(requestedPages).toEqual([1, 2]);
    expect(view.page).toBe(2);
  });

  it("will not advance past the last page or retreat before the first", async () => {
    server.use(usersHandlers.list(makePaginatedUsers({ users: [makeUser()], total: 15 })));

    const harness = renderViewModel(useUserListViewModel);
    await harness.settle(() => true);

    act(() => {
      harness.result.current.changePage("previous");
    });
    expect(harness.result.current.page).toBe(1);

    act(() => {
      harness.result.current.changePage("next");
    });
    await harness.settle((value) => value.pagination.page === 2);
    act(() => {
      harness.result.current.changePage("next");
    });
    expect(harness.result.current.page).toBe(2);
  });
});
