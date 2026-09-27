import { InvitationId } from "@org/contracts/EntityIds";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { makePendingInvitation, ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import { useOrgInvitationsListViewModel } from "./org-invitations-list.view-model";

const LAPSED_ID = InvitationId.parse("99999999-9999-9999-9999-999999999999");
const announced = () => notificationStore.get() !== null;

describe("org invitations list ViewModel", () => {
  it("flags a lapsed invitation as expired and a live one as not", async () => {
    server.use(
      orgsHandlers.findInvitations([
        makePendingInvitation(),
        makePendingInvitation({
          invitationId: LAPSED_ID,
          inviteeEmail: "lapsed@example.com",
          status: "expired",
        }),
      ]),
    );

    const view = await renderViewModel(() => useOrgInvitationsListViewModel(ORG_A_ID)).settle(
      () => true,
    );

    expect(view.rows).toEqual([
      {
        invitationId: makePendingInvitation().invitationId,
        email: "invitee@example.com",
        isExpired: false,
        expiresAtLabel: "2026-01-01",
      },
      {
        invitationId: LAPSED_ID,
        email: "lapsed@example.com",
        isExpired: true,
        expiresAtLabel: "2026-01-01",
      },
    ]);
  });

  it("reports emptiness once an empty list has arrived", async () => {
    server.use(orgsHandlers.findInvitations([]));

    const view = await renderViewModel(() => useOrgInvitationsListViewModel(ORG_A_ID)).settle(
      () => true,
    );

    expect(view.isEmpty).toBe(true);
  });

  it("announces a resend", async () => {
    server.use(
      orgsHandlers.findInvitations([makePendingInvitation()]),
      orgsHandlers.resendInvitation(),
    );

    const harness = renderViewModel(() => useOrgInvitationsListViewModel(ORG_A_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.resend(makePendingInvitation().invitationId);
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Invitation resent.",
    });
  });

  it("surfaces the server's message when the invitation is already closed", async () => {
    server.use(
      orgsHandlers.findInvitations([makePendingInvitation()]),
      orgsHandlers.resendInvitation({ result: "InvitationGoneError" }),
    );

    const harness = renderViewModel(() => useOrgInvitationsListViewModel(ORG_A_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.resend(makePendingInvitation().invitationId);
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "error",
      message: "Invitation is closed.",
    });
  });

  it("announces a revoke", async () => {
    server.use(
      orgsHandlers.findInvitations([makePendingInvitation()]),
      orgsHandlers.revokeInvitation(),
    );

    const harness = renderViewModel(() => useOrgInvitationsListViewModel(ORG_A_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.revoke(makePendingInvitation().invitationId);
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Invitation revoked.",
    });
  });
});
