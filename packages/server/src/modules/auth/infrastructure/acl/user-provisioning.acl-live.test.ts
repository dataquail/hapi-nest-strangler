import { deepStrictEqual } from "node:assert";

import { Err, Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { UserId } from "@/platform/ids/user-id.js";

import { UserProvisioningLive } from "./user-provisioning.acl-live.js";

const answering = (answer: unknown): AppCommandBus =>
  ({ execute: () => Promise.resolve(answer) }) as unknown as AppCommandBus;
const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

describe("UserProvisioningLive", () => {
  it("returns the created user's id", async () => {
    deepStrictEqual(
      (await new UserProvisioningLive(answering(Ok(userId))).provision("a@x.io")).unwrap(),
      userId,
    );
  });

  it("translates the user module's UserAlreadyExists into UserProvisioningConflict", async () => {
    const result = await new UserProvisioningLive(
      answering(Err({ _tag: "UserAlreadyExists", email: "a@x.io" })),
    ).provision("a@x.io");
    deepStrictEqual(result.unwrapErr()._tag, "UserProvisioningConflict");
  });
});
