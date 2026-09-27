import { deepStrictEqual } from "node:assert";

import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { makeIsMember } from "./is-member.policy.js";
import { makeIsOrgAdmin } from "./is-org-admin.policy.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };

describe("organization checks", () => {
  it("ask the lookup about the caller and the resolved organization", async () => {
    const seen: Array<[UserId, OrganizationId]> = [];
    const lookup = (u: UserId, o: OrganizationId) => {
      seen.push([u, o]);
      return Promise.resolve(Ok(true));
    };
    deepStrictEqual((await makeIsMember(lookup)(caller, { organizationId })).unwrap(), true);
    deepStrictEqual((await makeIsOrgAdmin(lookup)(caller, { organizationId })).unwrap(), true);
    deepStrictEqual(seen, [
      [userId, organizationId],
      [userId, organizationId],
    ]);
  });
});
