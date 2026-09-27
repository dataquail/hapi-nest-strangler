// ViewModel for the user list: page state, the query it drives, and the
// derived pagination view. A hook over TanStack Query and React state only;
// no component library, no View.

import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import type { Schemas } from "@/services/api/types";
import { usersQuery } from "@/services/data-access/users.queries";

export const PAGE_SIZE = 10;

export type PaginationView = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly isEmpty: boolean;
  readonly displayedRange: { readonly from: number; readonly to: number };
};

export const computePaginationView = (input: {
  readonly currentPage: number;
  readonly pageSize: number;
  readonly total: number;
}): PaginationView => {
  const safePageSize = Math.max(1, input.pageSize);
  const safeTotal = Math.max(0, input.total);
  // An empty set still occupies one page, so the UI reads "Page 1 of 1".
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const page = Math.min(Math.max(1, input.currentPage), totalPages);
  const isEmpty = safeTotal === 0;
  return {
    page,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    isEmpty,
    displayedRange: {
      from: isEmpty ? 0 : (page - 1) * safePageSize + 1,
      to: isEmpty ? 0 : Math.min(page * safePageSize, safeTotal),
    },
  };
};

export type PageChange = "next" | "previous";

export type UserListViewModel = {
  readonly users: ReadonlyArray<Schemas["User"]>;
  readonly pagination: PaginationView;
  readonly page: number;
  readonly changePage: (direction: PageChange) => void;
};

export const useUserListViewModel = (): UserListViewModel => {
  const [page, setPage] = React.useState(1);
  const { data } = useSuspenseQuery(usersQuery({ page, pageSize: PAGE_SIZE }));
  const pagination = computePaginationView({
    currentPage: page,
    pageSize: PAGE_SIZE,
    total: data.total,
  });
  const changePage = React.useCallback(
    (direction: PageChange) => {
      setPage(
        direction === "next"
          ? Math.min(pagination.totalPages, pagination.page + 1)
          : Math.max(1, pagination.page - 1),
      );
    },
    [pagination.page, pagination.totalPages],
  );
  return { users: data.users, pagination, page, changePage };
};
