import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { navigationRequestStore } from "@/services/navigation.shared";
import { notificationStore } from "@/services/notifications.shared";
import { ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import { useCreateOrgViewModel } from "./create-org.view-model";

describe("create org ViewModel", () => {
  it("rejects a blank name and accepts a filled one", () => {
    const harness = renderViewModel(useCreateOrgViewModel);
    expect(harness.result.current.errors?.name).toBeTypeOf("string");

    act(() => {
      harness.result.current.setName("Acme Inc.");
    });
    expect(harness.result.current.errors).toBeNull();
  });

  it("keeps the error hidden until the first submit attempt", () => {
    const harness = renderViewModel(useCreateOrgViewModel);
    expect(harness.result.current.visibleErrors).toBeNull();

    act(() => {
      harness.result.current.submit();
    });

    expect(harness.result.current.visibleErrors?.name).toBeTypeOf("string");
  });

  it("does not call the API, announce, or navigate when the name is blank", () => {
    const harness = renderViewModel(useCreateOrgViewModel);

    act(() => {
      harness.result.current.submit();
    });

    expect(notificationStore.get()).toBeNull();
    expect(navigationRequestStore.get()).toBeNull();
  });

  it("creates the org, announces it, clears the form, and moves into the new org", async () => {
    server.use(orgsHandlers.create({ result: "success", id: ORG_B_ID }));

    const harness = renderViewModel(useCreateOrgViewModel);
    act(() => {
      harness.result.current.setName("Acme Inc.");
    });
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle((value) => value.fields.name === "");

    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Organization created!",
    });
    expect(harness.result.current.submitAttempted).toBe(false);
    expect(navigationRequestStore.get()?.href).toBe(`/orgs/${ORG_B_ID}`);
  });

  it("stays put and keeps what was typed when the server refuses", async () => {
    server.use(orgsHandlers.create({ result: "SuperAdminCannotOwnOrganizationError" }));

    const harness = renderViewModel(useCreateOrgViewModel);
    act(() => {
      harness.result.current.setName("Acme Inc.");
    });
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle(() => notificationStore.get() !== null);

    expect(notificationStore.get()).toMatchObject({ kind: "error" });
    expect(harness.result.current.fields).toEqual({ name: "Acme Inc." });
    expect(navigationRequestStore.get()).toBeNull();
  });
});
