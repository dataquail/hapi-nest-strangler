import { InvitationId } from "@org/contracts/EntityIds";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makePendingInvitation, ORG_A_ID } from "@/test/fixtures/organization";

import { OrgInvitationsList } from "./org-invitations-list.view";
import type * as ViewModelModule from "./org-invitations-list.view-model";
import {
  computeOrgInvitationsListView,
  type OrgInvitationsListViewModel,
} from "./org-invitations-list.view-model";

const viewModel = vi.hoisted(() => ({ current: null as unknown as OrgInvitationsListViewModel }));

vi.mock("./org-invitations-list.view-model", async (importOriginal) => ({
  ...(await importOriginal<typeof ViewModelModule>()),
  useOrgInvitationsListViewModel: () => viewModel.current,
}));

const LAPSED_ID = InvitationId.parse("99999999-9999-9999-9999-999999999999");

const renderInvitations = (
  invitations: ReadonlyArray<ReturnType<typeof makePendingInvitation>>,
) => {
  viewModel.current = {
    ...computeOrgInvitationsListView(invitations),
    resend: vi.fn(),
    revoke: vi.fn(),
    isResending: false,
    isRevoking: false,
  };
  return render(<OrgInvitationsList orgId={ORG_A_ID} />);
};

describe("OrgInvitationsList view", () => {
  it("labels a live invitation Pending and a lapsed one Expired", () => {
    renderInvitations([
      makePendingInvitation(),
      makePendingInvitation({
        invitationId: LAPSED_ID,
        inviteeEmail: "lapsed@example.com",
        status: "expired",
      }),
    ]);

    const statuses = screen.getAllByTestId("org-invitations-status");
    expect(statuses.map((status) => status.textContent)).toEqual(["Pending", "Expired"]);
  });

  it("offers Resend and Revoke on every row", () => {
    renderInvitations([makePendingInvitation()]);

    expect(screen.getAllByTestId("org-invitations-resend")).toHaveLength(1);
    expect(screen.getAllByTestId("org-invitations-revoke")).toHaveLength(1);
  });

  it("shows the empty state instead of a list when nothing is outstanding", () => {
    renderInvitations([]);

    expect(screen.getByText("No pending invitations.")).toBeInTheDocument();
    expect(screen.queryByTestId("org-invitations")).not.toBeInTheDocument();
  });
});
