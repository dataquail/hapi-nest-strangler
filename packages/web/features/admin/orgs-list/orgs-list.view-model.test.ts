import { OrganizationContract } from "@org/contracts/api/Contracts";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import {
  makeOrganization,
  makePaginatedOrganizations,
  ORG_B_ID,
} from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { PAGE_SIZE, useOrgsListViewModel } from "./orgs-list.view-model";

const DELETED_AT = "2026-02-03T00:00:00.000Z";

describe("admin orgs list ViewModel", () => {
  it("labels an active row and links it to its detail page", async () => {
    server.use(orgsHandlers.findAll([makeOrganization({ name: "Org A" })]));

    const view = await renderViewModel(useOrgsListViewModel).settle(() => true);

    expect(view.rows).toEqual([
      {
        id: makeOrganization().id,
        name: "Org A",
        createdAtLabel: "2026-01-01",
        isDeleted: false,
        deletedAtLabel: null,
        href: `/admin/orgs/${makeOrganization().id}`,
      },
    ]);
  });

  it("gives a soft-deleted row no link, since there is no page to visit", async () => {
    server.use(orgsHandlers.findAll([makeOrganization({ id: ORG_B_ID, deletedAt: DELETED_AT })]));

    const view = await renderViewModel(useOrgsListViewModel).settle(() => true);

    expect(view.rows[0]).toMatchObject({
      isDeleted: true,
      deletedAtLabel: "2026-02-03",
      href: null,
    });
  });

  it("derives pagination from the server's total, not the rows on this page", async () => {
    server.use(
      orgsHandlers.findAll(
        makePaginatedOrganizations({ organizations: [makeOrganization()], total: 25 }),
      ),
    );

    const view = await renderViewModel(useOrgsListViewModel).settle(() => true);

    expect(view).toMatchObject({
      page: 1,
      total: 25,
      totalPages: 3,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it("refetches the newly selected page", async () => {
    const requested: Array<number> = [];
    server.use(
      typedHandler(OrganizationContract.AdminGroup.routes.findAll, ({ urlParams }) => {
        requested.push(urlParams.page);
        return ok(
          makePaginatedOrganizations({
            organizations: [makeOrganization()],
            page: urlParams.page,
            total: 25,
          }),
        );
      }),
    );

    const harness = renderViewModel(useOrgsListViewModel);
    await harness.settle(() => true);
    expect(requested).toEqual([1]);

    act(() => {
      harness.result.current.changePage("next");
    });
    await harness.settle((value) => value.page === 2);

    expect(requested).toEqual([1, 2]);
  });

  it("returns to the first page when the deleted filter is flipped", async () => {
    const requested: Array<string | undefined> = [];
    server.use(
      typedHandler(OrganizationContract.AdminGroup.routes.findAll, ({ urlParams }) => {
        requested.push(urlParams.includeDeleted);
        return ok(
          makePaginatedOrganizations({
            organizations: [makeOrganization()],
            page: urlParams.page,
            total: 25,
          }),
        );
      }),
    );

    const harness = renderViewModel(useOrgsListViewModel);
    await harness.settle(() => true);
    act(() => {
      harness.result.current.changePage("next");
    });
    await harness.settle((value) => value.page === 2);

    act(() => {
      harness.result.current.toggleIncludeDeleted();
    });
    const view = await harness.settle((value) => value.includeDeleted);
    expect(view.page).toBe(1);
    expect(requested).toEqual(["false", "false", "true"]);
  });

  it("uses the whole page size the list was built for", () => {
    expect(PAGE_SIZE).toBe(10);
  });

  it("announces a soft delete", async () => {
    server.use(orgsHandlers.findAll([makeOrganization()]), orgsHandlers.softDelete());

    const harness = renderViewModel(useOrgsListViewModel);
    await harness.settle(() => true);

    act(() => {
      harness.result.current.softDelete(makeOrganization().id);
    });
    await harness.settle(() => notificationStore.get() !== null);

    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Organization deleted.",
    });
  });

  it("surfaces the server's refusal to restore an org that is not deleted", async () => {
    server.use(
      orgsHandlers.findAll([makeOrganization()]),
      orgsHandlers.restore({ result: "OrganizationNotDeletedError" }),
    );

    const harness = renderViewModel(useOrgsListViewModel);
    await harness.settle(() => true);

    act(() => {
      harness.result.current.restore(makeOrganization().id);
    });
    await harness.settle(() => notificationStore.get() !== null);

    expect(notificationStore.get()).toMatchObject({
      kind: "error",
      message: "Organization is not deleted.",
    });
  });
});
