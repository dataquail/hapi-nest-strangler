// ViewModel for the super-admin organizations list: the two knobs (page, and
// whether soft-deleted orgs are shown), the query they drive, the per-row
// display state, and the two writes a row offers.
//
// A soft-delete or restore dirties both organization roots: the platform
// listing, and every affected member's own switcher.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import type { Schemas } from "@/services/api/types";
import { adminOrgsQuery, restoreOrg, softDeleteOrg } from "@/services/data-access/orgs.queries";
import { formatDay, formatDayOrNull } from "@/services/format/date.shared";
import { useApiMutation } from "@/services/query/use-api-mutation";

export const PAGE_SIZE = 10;

export type OrgRowView = {
  readonly id: string;
  readonly name: string;
  readonly createdAtLabel: string;
  readonly isDeleted: boolean;
  readonly deletedAtLabel: string | null;
  readonly href: string | null;
};

export type OrgsListView = {
  readonly rows: ReadonlyArray<OrgRowView>;
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly isEmpty: boolean;
  readonly includeDeleted: boolean;
};

export const computeOrgsListView = (input: {
  readonly page: Schemas["PaginatedOrganizations"];
  readonly currentPage: number;
  readonly includeDeleted: boolean;
}): OrgsListView => {
  const total = Math.max(0, input.page.total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, input.currentPage), totalPages);
  const rows = input.page.organizations.map((org): OrgRowView => {
    const isDeleted = org.deletedAt !== null;
    return {
      id: org.id,
      name: org.name,
      createdAtLabel: formatDay(org.createdAt),
      isDeleted,
      deletedAtLabel: formatDayOrNull(org.deletedAt),
      // A deleted org has no detail page to visit, so the row is plain text.
      href: isDeleted ? null : `/admin/orgs/${org.id}`,
    };
  });
  return {
    rows,
    page,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    isEmpty: rows.length === 0,
    includeDeleted: input.includeDeleted,
  };
};

export type PageChange = "next" | "previous";

export type OrgsListViewModel = OrgsListView & {
  readonly changePage: (direction: PageChange) => void;
  readonly toggleIncludeDeleted: () => void;
  readonly softDelete: (id: OrganizationId | string) => void;
  readonly restore: (id: OrganizationId | string) => void;
};

const ORGANIZATION_ROOTS = [queryKeys.organizations.all, queryKeys.adminOrganizations.all];

const asOrgId = (id: string): OrganizationId => id as OrganizationId;

export const useOrgsListViewModel = (): OrgsListViewModel => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [includeDeleted, setIncludeDeleted] = React.useState(false);
  const { data } = useSuspenseQuery(
    adminOrgsQuery({
      page: currentPage,
      pageSize: PAGE_SIZE,
      includeDeleted: includeDeleted ? "true" : "false",
    }),
  );
  const view = React.useMemo(
    () => computeOrgsListView({ page: data, currentPage, includeDeleted }),
    [data, currentPage, includeDeleted],
  );

  const changePage = React.useCallback(
    (direction: PageChange) => {
      setCurrentPage(
        direction === "next"
          ? Math.min(view.totalPages, view.page + 1)
          : Math.max(1, view.page - 1),
      );
    },
    [view.page, view.totalPages],
  );

  // Flipping the filter changes how many rows exist, so the current page may
  // no longer address anything; the first page is the only always-valid one.
  const toggleIncludeDeleted = React.useCallback(() => {
    setIncludeDeleted((previous) => !previous);
    setCurrentPage(1);
  }, []);

  const softDeleteMutation = useApiMutation({
    mutationFn: (id: string) => softDeleteOrg(asOrgId(id)),
    invalidates: ORGANIZATION_ROOTS,
    notify: {
      success: () => "Organization deleted.",
      errors: {
        OrganizationNotFoundError: (error) => error.message,
        Forbidden: (error) => error.message,
      },
    },
  });
  const restoreMutation = useApiMutation({
    mutationFn: (id: string) => restoreOrg(asOrgId(id)),
    invalidates: ORGANIZATION_ROOTS,
    notify: {
      success: () => "Organization restored.",
      errors: {
        OrganizationNotFoundError: (error) => error.message,
        OrganizationNotDeletedError: (error) => error.message,
        Forbidden: (error) => error.message,
      },
    },
  });

  return {
    ...view,
    changePage,
    toggleIncludeDeleted,
    softDelete: softDeleteMutation.mutate,
    restore: restoreMutation.mutate,
  };
};
