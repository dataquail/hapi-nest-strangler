import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "./api/api-error";
import {
  notificationStore,
  notifyFailure,
  notifySuccess,
  pushNotification,
} from "./notifications.shared";

describe("notifications", () => {
  beforeEach(() => {
    notificationStore.set(null);
  });

  it("records a success notification", () => {
    notifySuccess({ success: (value: { name: string }) => `Saved ${value.name}` }, { name: "Ada" });
    expect(notificationStore.get()).toEqual({ seq: 1, kind: "success", message: "Saved Ada" });
  });

  it("uses the per-tag handler for a matching failure", () => {
    notifyFailure(
      { errors: { BoomError: (error) => error.message } },
      new ApiError(500, { _tag: "BoomError", message: "disk full" }),
    );
    expect(notificationStore.get()).toMatchObject({ kind: "error", message: "disk full" });
  });

  it("falls back to `otherwise` for an unhandled tag, then to a default", () => {
    notifyFailure(
      { errors: { BoomError: () => "never" }, otherwise: "Could not save" },
      new ApiError(500, { _tag: "OtherError" }),
    );
    expect(notificationStore.get()?.message).toBe("Could not save");

    notifyFailure({}, new Error("not an api error"));
    expect(notificationStore.get()?.message).toBe("Something went wrong");
  });

  it("advances the sequence so a repeated message is still a new notification", () => {
    pushNotification({ kind: "success", message: "Saved" });
    pushNotification({ kind: "success", message: "Saved" });
    expect(notificationStore.get()).toEqual({ seq: 2, kind: "success", message: "Saved" });
  });
});
