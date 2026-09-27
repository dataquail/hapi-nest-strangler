import { deepStrictEqual, match } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { DeviceGrantSpecifications } from "../domain/device-grant/device-grant.specification.js";
import { CredentialHash } from "../domain/domain-services/credential-hash.domain-service.js";
import { DeviceGrantRepositoryFake } from "../infrastructure/repositories/device-grant.repository-fake.js";
import { StartDeviceGrantCommand } from "./start-device-grant.command.js";
import { StartDeviceGrantHandler } from "./start-device-grant.handler.js";

describe("StartDeviceGrantHandler", () => {
  it("persists a pending grant keyed by the device code's hash and returns both codes", async () => {
    const grants = new DeviceGrantRepositoryFake();
    const result = await new StartDeviceGrantHandler(grants, PassThroughUnitOfWork).execute(
      new StartDeviceGrantCommand({ ttlSeconds: 600 }),
    );
    const { deviceCode, userCode } = result.unwrap();
    match(userCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const stored = (
      await grants.findOne(DeviceGrantSpecifications.withCodeHash(CredentialHash.of(deviceCode)))
    ).unwrap();
    deepStrictEqual(stored?.status, "pending");
    deepStrictEqual(stored?.userCode, userCode);
  });
});
