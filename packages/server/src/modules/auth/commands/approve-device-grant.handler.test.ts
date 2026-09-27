import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantId } from "../domain/device-grant/device-grant.id.js";
import { DeviceGrantRootOps } from "../domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "../domain/device-grant/device-grant.specification.js";
import { DeviceGrantRepositoryFake } from "../infrastructure/repositories/device-grant.repository-fake.js";
import { ApproveDeviceGrantCommand } from "./approve-device-grant.command.js";
import { ApproveDeviceGrantHandler } from "./approve-device-grant.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

const seeded = async (ttlSeconds: number) => {
  const grants = new DeviceGrantRepositoryFake();
  await grants.insertOne(
    DeviceGrantRootOps.start({
      id: DeviceGrantId.parse("22222222-2222-2222-2222-222222222222"),
      deviceCodeHash: "h",
      userCode: "ABCD-EFGH",
      now: new Date(),
      ttlSeconds,
    }),
  );
  return grants;
};

describe("ApproveDeviceGrantHandler", () => {
  it("binds a pending grant to the approving user", async () => {
    const grants = await seeded(600);
    const result = await new ApproveDeviceGrantHandler(grants, PassThroughUnitOfWork).execute(
      new ApproveDeviceGrantCommand({ userCode: "ABCD-EFGH", userId }),
    );
    deepStrictEqual(result.isOk(), true);
    const stored = (
      await grants.findOne(DeviceGrantSpecifications.withUserCode("ABCD-EFGH"))
    ).unwrap();
    deepStrictEqual(stored?.status, "approved");
    deepStrictEqual(stored?.userId, userId);
  });

  it("reports DeviceGrantNotFound for an unknown code and DeviceGrantExpired for a lapsed one", async () => {
    const handler = new ApproveDeviceGrantHandler(await seeded(600), PassThroughUnitOfWork);
    const unknown = await handler.execute(
      new ApproveDeviceGrantCommand({ userCode: "ZZZZ-ZZZZ", userId }),
    );
    deepStrictEqual(unknown.unwrapErr()._tag, "DeviceGrantNotFound");
    const lapsed = await new ApproveDeviceGrantHandler(
      await seeded(0),
      PassThroughUnitOfWork,
    ).execute(new ApproveDeviceGrantCommand({ userCode: "ABCD-EFGH", userId }));
    deepStrictEqual(lapsed.unwrapErr()._tag, "DeviceGrantExpired");
  });
});
