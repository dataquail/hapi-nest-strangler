import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import { useInviteFormViewModel } from "./invite-form.view-model";

describe("invite form ViewModel", () => {
  it("rejects an address that is too short to be one, and accepts a real one", () => {
    const harness = renderViewModel(() => useInviteFormViewModel(ORG_A_ID));
    expect(harness.result.current.errors?.email).toBeTypeOf("string");

    act(() => {
      harness.result.current.setEmail("teammate@example.com");
    });
    expect(harness.result.current.errors).toBeNull();
  });

  it("keeps the error hidden until the first submit attempt", () => {
    const harness = renderViewModel(() => useInviteFormViewModel(ORG_A_ID));
    expect(harness.result.current.visibleErrors).toBeNull();

    act(() => {
      harness.result.current.submit();
    });

    expect(harness.result.current.visibleErrors?.email).toBeTypeOf("string");
  });

  it("does not call the API, or claim success, when the address is invalid", () => {
    const harness = renderViewModel(() => useInviteFormViewModel(ORG_A_ID));

    act(() => {
      harness.result.current.submit();
    });

    expect(notificationStore.get()).toBeNull();
  });

  it("sends the invitation, announces it, and clears the field", async () => {
    server.use(orgsHandlers.inviteUser());

    const harness = renderViewModel(() => useInviteFormViewModel(ORG_A_ID));
    act(() => {
      harness.result.current.setEmail("teammate@example.com");
    });
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle((value) => value.fields.email === "");

    expect(notificationStore.get()).toMatchObject({ kind: "success", message: "Invitation sent." });
    expect(harness.result.current.submitAttempted).toBe(false);
  });

  it("keeps what was typed when the server refuses", async () => {
    server.use(orgsHandlers.inviteUser({ result: "OrganizationNotFoundError" }));

    const harness = renderViewModel(() => useInviteFormViewModel(ORG_A_ID));
    act(() => {
      harness.result.current.setEmail("teammate@example.com");
    });
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle(() => notificationStore.get() !== null);

    expect(notificationStore.get()).toMatchObject({ kind: "error", message: "Org not found." });
    expect(harness.result.current.fields).toEqual({ email: "teammate@example.com" });
  });
});
