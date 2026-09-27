import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { makeCreateUserPayload } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import { type CreateUserFields, useCreateUserViewModel } from "./create-user.view-model";

const VALID: CreateUserFields = {
  email: makeCreateUserPayload().email,
  country: "US",
  street: "2 B St",
  postalCode: "10002",
};

describe("create user ViewModel", () => {
  it("edits one field without disturbing the others", () => {
    const harness = renderViewModel(() => useCreateUserViewModel());
    act(() => {
      harness.result.current.setField("email", "ada@example.com");
    });
    act(() => {
      harness.result.current.setField("country", "GB");
    });

    expect(harness.result.current.fields).toEqual({
      email: "ada@example.com",
      country: "GB",
      street: "",
      postalCode: "",
    });
  });

  it("reports an error per unsatisfied contract field, and none once satisfied", () => {
    const harness = renderViewModel(() => useCreateUserViewModel());
    expect(Object.keys(harness.result.current.errors ?? {}).sort()).toEqual([
      "country",
      "email",
      "postalCode",
      "street",
    ]);

    act(() => {
      harness.result.current.setFields(VALID);
    });
    expect(harness.result.current.errors).toBeNull();
  });

  it("keeps errors hidden until the first submit attempt", () => {
    const harness = renderViewModel(() => useCreateUserViewModel());
    act(() => {
      harness.result.current.setField("email", "a");
    });
    expect(harness.result.current.visibleErrors).toBeNull();

    act(() => {
      harness.result.current.submit();
    });

    expect(harness.result.current.submitAttempted).toBe(true);
    expect(harness.result.current.visibleErrors?.email).toBeTypeOf("string");
  });

  it("does not call the API, or claim success, when validation fails", () => {
    // No handler registered: MSW errors on any unhandled request.
    const harness = renderViewModel(() => useCreateUserViewModel());
    act(() => {
      harness.result.current.setField("email", "a");
    });

    act(() => {
      harness.result.current.submit();
    });

    expect(notificationStore.get()).toBeNull();
  });

  it("creates the user, announces it, and clears the form", async () => {
    server.use(usersHandlers.create({ result: "success" }));

    const harness = renderViewModel(() => useCreateUserViewModel(VALID));
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle((value) => value.fields.email === "");

    expect(notificationStore.get()).toMatchObject({ kind: "success", message: "User created!" });
    expect(harness.result.current.fields).toEqual({
      email: "",
      country: "",
      street: "",
      postalCode: "",
    });
    expect(harness.result.current.submitAttempted).toBe(false);
  });

  it("surfaces a duplicate-email failure and keeps what the user typed", async () => {
    server.use(
      usersHandlers.create({ result: "UserAlreadyExistsError", message: "That email is taken." }),
    );

    const harness = renderViewModel(() => useCreateUserViewModel(VALID));
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle(() => notificationStore.get() !== null);

    expect(notificationStore.get()).toMatchObject({
      kind: "error",
      message: "That email is taken.",
    });
    expect(harness.result.current.fields).toEqual(VALID);
  });
});
