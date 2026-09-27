import { deepStrictEqual } from "node:assert";

import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { UserId } from "@/platform/ids/user-id.js";

import { PlatformRolesLive } from "./platform-roles.acl-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

const answering = (roles: ReadonlyArray<string>): AppQueryBus =>
  ({ execute: () => Promise.resolve(Ok({ userId, roles })) }) as unknown as AppQueryBus;

describe("PlatformRolesLive", () => {
  it("reports true when the role module lists super_admin", async () => {
    deepStrictEqual(
      (await new PlatformRolesLive(answering(["super_admin"])).isSuperAdmin(userId)).unwrap(),
      true,
    );
  });

  it("reports false when the caller holds no platform roles", async () => {
    deepStrictEqual(
      (await new PlatformRolesLive(answering([])).isSuperAdmin(userId)).unwrap(),
      false,
    );
  });

  it("reports false for a platform role that is not super_admin", async () => {
    deepStrictEqual(
      (await new PlatformRolesLive(answering(["other"])).isSuperAdmin(userId)).unwrap(),
      false,
    );
  });
});
