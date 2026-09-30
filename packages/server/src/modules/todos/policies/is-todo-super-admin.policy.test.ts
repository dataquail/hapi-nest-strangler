import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { makeIsTodoSuperAdmin } from "./is-todo-super-admin.policy.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const caller = { sessionId: "s", userId };

describe("makeIsTodoSuperAdmin", () => {
  it("allows a super admin and denies an ordinary caller", async () => {
    deepStrictEqual(
      (await makeIsTodoSuperAdmin(new PlatformRolesFake(new Set([userId])))(caller)).unwrap(),
      true,
    );
    deepStrictEqual((await makeIsTodoSuperAdmin(new PlatformRolesFake())(caller)).unwrap(), false);
  });
});
