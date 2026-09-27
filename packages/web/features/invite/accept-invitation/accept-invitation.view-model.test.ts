import { OrganizationContract } from "@org/contracts/api/Contracts";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { navigationRequestStore } from "@/services/navigation.shared";
import { notificationStore } from "@/services/notifications.shared";
import { ORG_B_ID } from "@/test/fixtures/organization";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { fail, ok, typedHandler } from "@/test/typed-handler";

import { useAcceptInvitationViewModel } from "./accept-invitation.view-model";

const acceptRoute = OrganizationContract.InvitationGroup.routes.accept;
const announced = () => notificationStore.get() !== null;

describe("accept invitation ViewModel", () => {
  it("moves the caller into the org they just joined", async () => {
    const tokens: Array<string> = [];
    server.use(
      typedHandler(acceptRoute, ({ path }) => {
        tokens.push(path.token);
        return ok({ organizationId: ORG_B_ID });
      }),
    );

    const harness = renderViewModel(() => useAcceptInvitationViewModel("tok-123"));
    act(() => {
      harness.result.current.accept();
    });
    await harness.settle(announced);

    expect(tokens).toEqual(["tok-123"]);
    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Invitation accepted!",
    });
    expect(navigationRequestStore.get()?.href).toBe(`/orgs/${ORG_B_ID}`);
  });

  it("stays on the page when the invitation is already closed, so the reason can be read", async () => {
    server.use(
      typedHandler(acceptRoute, () =>
        fail(OrganizationContract.InvitationGoneError, {
          reason: "revoked",
          message: "That invitation was revoked.",
        }),
      ),
    );

    const harness = renderViewModel(() => useAcceptInvitationViewModel("tok-123"));
    act(() => {
      harness.result.current.accept();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "error",
      message: "That invitation was revoked.",
    });
    expect(navigationRequestStore.get()).toBeNull();
  });
});
