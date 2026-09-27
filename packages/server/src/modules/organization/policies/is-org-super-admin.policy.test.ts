import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { makeIsOrgSuperAdmin } from "./is-org-super-admin.policy.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

describe("makeIsOrgSuperAdmin", () => {
  it("delegates to the roles port", async () => {
    deepStrictEqual(
      (
        await makeIsOrgSuperAdmin(new PlatformRolesFake(new Set([userId])))({
          sessionId: "s",
          userId,
        })
      ).unwrap(),
      true,
    );
    deepStrictEqual(
      (await makeIsOrgSuperAdmin(new PlatformRolesFake())({ sessionId: "s", userId })).unwrap(),
      false,
    );
  });
});
