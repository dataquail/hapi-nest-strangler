import { UserId } from "@org/contracts/EntityIds";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeOrganizationMember, ORG_A_ID } from "@/test/fixtures/organization";

import { OrgMembersList } from "./org-members-list.view";
import type * as ViewModelModule from "./org-members-list.view-model";
import {
  computeOrgMembersListView,
  type OrgMembersListViewModel,
} from "./org-members-list.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as OrgMembersListViewModel }));

vi.mock("./org-members-list.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useOrgMembersListViewModel: () => viewModel.current,
}));

const BOB_ID = UserId.parse("88888888-8888-8888-8888-888888888888");

const renderRoster = (
  members: ReadonlyArray<ReturnType<typeof makeOrganizationMember>>,
  canManage = true,
) => {
  viewModel.current = {
    ...computeOrgMembersListView(members),
    remove: vi.fn(),
    promote: vi.fn(),
    demote: vi.fn(),
    isChangingRole: false,
    isRemoving: false,
  };
  return render(<OrgMembersList orgId={ORG_A_ID} canManage={canManage} />);
};

describe("OrgMembersList view", () => {
  it("badges the admin and offers Demote for them, Promote for everyone else", () => {
    renderRoster([
      makeOrganizationMember({ isAdmin: true }),
      makeOrganizationMember({ userId: BOB_ID, email: "bob@example.com" }),
    ]);

    expect(screen.getAllByTestId("admin-org-members-admin-badge")).toHaveLength(1);
    expect(screen.getAllByTestId("admin-org-members-demote")).toHaveLength(1);
    expect(screen.getAllByTestId("admin-org-members-promote")).toHaveLength(1);
  });

  it("hides every management control from someone who cannot manage", () => {
    renderRoster([makeOrganizationMember()], false);

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-org-members-promote")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-org-members-remove")).not.toBeInTheDocument();
  });

  it("shows the empty state instead of a roster when the org has no members", () => {
    renderRoster([]);

    expect(screen.getByText("No members in this organization yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-org-members")).not.toBeInTheDocument();
  });
});
