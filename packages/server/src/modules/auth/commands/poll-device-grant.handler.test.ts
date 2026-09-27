import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenSpecifications } from "../domain/api-token/api-token.specification.js";
import { DeviceGrantId } from "../domain/device-grant/device-grant.id.js";
import { DeviceGrantRootOps } from "../domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "../domain/device-grant/device-grant.specification.js";
import { CredentialHash } from "../domain/domain-services/credential-hash.domain-service.js";
import { ApiTokenRepositoryFake } from "../infrastructure/repositories/api-token.repository-fake.js";
import { DeviceGrantRepositoryFake } from "../infrastructure/repositories/device-grant.repository-fake.js";
import { PollDeviceGrantCommand } from "./poll-device-grant.command.js";
import { PollDeviceGrantHandler } from "./poll-device-grant.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const deviceCode = "device-code-plaintext";

const seeded = async (options: { approved: boolean; ttlSeconds: number }) => {
  const grants = new DeviceGrantRepositoryFake();
  const tokens = new ApiTokenRepositoryFake();
  const now = new Date();
  const pending = DeviceGrantRootOps.start({
    id: DeviceGrantId.parse("22222222-2222-2222-2222-222222222222"),
    deviceCodeHash: CredentialHash.of(deviceCode),
    userCode: "ABCD-EFGH",
    now,
    ttlSeconds: options.ttlSeconds,
  });
  await grants.insertOne(
    options.approved ? DeviceGrantRootOps.approve({ grant: pending, userId, now }) : pending,
  );
  return {
    grants,
    tokens,
    handler: new PollDeviceGrantHandler(grants, tokens, PassThroughUnitOfWork),
  };
};

const poll = new PollDeviceGrantCommand({ deviceCode, tokenExpiresInDays: 30 });

describe("PollDeviceGrantHandler", () => {
  it("mints a token for the approving user and consumes the grant", async () => {
    const { grants, handler, tokens } = await seeded({ approved: true, ttlSeconds: 600 });
    const result = await handler.execute(poll);
    deepStrictEqual(result.unwrap().apiToken.userId, userId);
    deepStrictEqual(
      (await tokens.findMany(ApiTokenSpecifications.forUser(userId))).unwrap().length,
      1,
    );
    deepStrictEqual(
      (await grants.findOne(DeviceGrantSpecifications.withUserCode("ABCD-EFGH"))).unwrap(),
      null,
    );
    deepStrictEqual((await handler.execute(poll)).unwrapErr()._tag, "DeviceGrantNotFound");
  });

  it("reports pending while unapproved", async () => {
    const { handler } = await seeded({ approved: false, ttlSeconds: 600 });
    deepStrictEqual((await handler.execute(poll)).unwrapErr()._tag, "DeviceGrantPending");
  });

  it("reports expired and consumes a lapsed grant", async () => {
    const { grants, handler } = await seeded({ approved: true, ttlSeconds: 0 });
    deepStrictEqual((await handler.execute(poll)).unwrapErr()._tag, "DeviceGrantExpired");
    deepStrictEqual(
      (await grants.findOne(DeviceGrantSpecifications.withUserCode("ABCD-EFGH"))).unwrap(),
      null,
    );
  });

  it("reports not found for an unknown device code", async () => {
    const { handler } = await seeded({ approved: true, ttlSeconds: 600 });
    const result = await handler.execute(
      new PollDeviceGrantCommand({ deviceCode: "other", tokenExpiresInDays: 30 }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "DeviceGrantNotFound");
  });
});
