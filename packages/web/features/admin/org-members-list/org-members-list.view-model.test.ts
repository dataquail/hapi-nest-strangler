import { OrganizationContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { makeOrganizationMember, ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { useOrgMembersListViewModel } from "./org-members-list.view-model";

const BOB_ID = UserId.parse("88888888-8888-8888-8888-888888888888");
const announced = () => notificationStore.get() !== null;

describe("org members list ViewModel", () => {
  it("maps each member to a row, carrying the admin flag and joined date", async () => {
    server.use(
      orgsHandlers.findMembers([
        makeOrganizationMember({ isAdmin: true }),
        makeOrganizationMember({ userId: BOB_ID, email: "bob@example.com" }),
      ]),
    );

    const view = await renderViewModel(() => useOrgMembersListViewModel(ORG_A_ID)).settle(
      () => true,
    );

    expect(view.rows).toEqual([
      {
        userId: makeOrganizationMember().userId,
        email: "alice@example.com",
        joinedAtLabel: "2026-01-01",
        isAdmin: true,
      },
      { userId: BOB_ID, email: "bob@example.com", joinedAtLabel: "2026-01-01", isAdmin: false },
    ]);
  });

  it("reports emptiness once an empty roster has arrived", async () => {
    server.use(orgsHandlers.findMembers([]));

    const view = await renderViewModel(() => useOrgMembersListViewModel(ORG_A_ID)).settle(
      () => true,
    );

    expect(view.isEmpty).toBe(true);
  });

  it("promotes the member it was given, in the org it was given", async () => {
    const promoted: Array<{ orgId: string; userId: string }> = [];
    server.use(
      orgsHandlers.findMembers([makeOrganizationMember()]),
      typedHandler(OrganizationContract.Group.routes.promoteMember, ({ path }) => {
        promoted.push({ orgId: path.orgId, userId: path.userId });
        return ok(undefined);
      }),
    );

    const harness = renderViewModel(() => useOrgMembersListViewModel(ORG_A_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.promote(BOB_ID);
    });
    await harness.settle(announced);

    expect(promoted).toEqual([{ orgId: ORG_A_ID, userId: BOB_ID }]);
    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Member promoted to admin.",
    });
  });

  it("surfaces a role conflict rather than claiming the demotion worked", async () => {
    server.use(
      orgsHandlers.findMembers([makeOrganizationMember()]),
      orgsHandlers.demoteMember({ result: "OrganizationRoleConflictError" }),
    );

    const harness = renderViewModel(() => useOrgMembersListViewModel(ORG_A_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.demote(BOB_ID);
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({ kind: "error", message: "Not an admin." });
  });

  it("announces a removal", async () => {
    server.use(orgsHandlers.findMembers([makeOrganizationMember()]), orgsHandlers.removeMember());

    const harness = renderViewModel(() => useOrgMembersListViewModel(ORG_A_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.remove(BOB_ID);
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({ kind: "success", message: "Member removed." });
  });
});
