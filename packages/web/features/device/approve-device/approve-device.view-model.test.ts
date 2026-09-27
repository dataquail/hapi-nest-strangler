import { AuthContract } from "@org/contracts/api/Contracts";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { deviceHandlers } from "@/test/handlers/device";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { useApproveDeviceViewModel } from "./approve-device.view-model";

const FROM_URL = "ABCD-2345";
const announced = () => notificationStore.get() !== null;

describe("approve device ViewModel", () => {
  it("starts pre-filled with the code the URL carried", () => {
    const harness = renderViewModel(() => useApproveDeviceViewModel(FROM_URL));

    expect(harness.result.current.fields).toEqual({ userCode: FROM_URL });
    expect(harness.result.current.errors).toBeNull();
  });

  it("starts empty, and invalid, when the URL carried no code", () => {
    const harness = renderViewModel(() => useApproveDeviceViewModel(""));

    expect(harness.result.current.fields).toEqual({ userCode: "" });
    expect(harness.result.current.errors?.userCode).toBeTypeOf("string");
  });

  it("keeps the error hidden until the first submit attempt", () => {
    const harness = renderViewModel(() => useApproveDeviceViewModel(""));
    expect(harness.result.current.visibleErrors).toBeNull();

    act(() => {
      harness.result.current.submit();
    });

    expect(harness.result.current.submitAttempted).toBe(true);
    expect(harness.result.current.visibleErrors?.userCode).toBeTypeOf("string");
  });

  it("does not call the API, or claim success, with no code", () => {
    const harness = renderViewModel(() => useApproveDeviceViewModel(""));

    act(() => {
      harness.result.current.submit();
    });

    expect(notificationStore.get()).toBeNull();
    expect(harness.result.current.isApproved).toBe(false);
  });

  it("submits the code the user actually sees, announces it, and stays approved", async () => {
    const submitted: Array<string> = [];
    server.use(
      typedHandler(AuthContract.DeviceApprovalGroup.routes.approve, ({ payload }) => {
        submitted.push(payload.userCode);
        return ok(undefined);
      }),
    );

    const harness = renderViewModel(() => useApproveDeviceViewModel(FROM_URL));
    act(() => {
      harness.result.current.setUserCode("WXYZ-9876");
    });
    act(() => {
      harness.result.current.submit();
    });
    const view = await harness.settle((value) => value.isApproved);

    expect(submitted).toEqual(["WXYZ-9876"]);
    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Device approved — return to your terminal.",
    });
    expect(view.isApproved).toBe(true);
  });

  it("surfaces an expired code rather than claiming approval", async () => {
    server.use(deviceHandlers.approve({ result: "Gone" }));

    const harness = renderViewModel(() => useApproveDeviceViewModel(FROM_URL));
    act(() => {
      harness.result.current.submit();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "error",
      message: "That code has expired.",
    });
    expect(harness.result.current.isApproved).toBe(false);
  });
});
