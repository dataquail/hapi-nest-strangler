import { deepStrictEqual } from "node:assert";

import { Err, Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationAccessLive } from "./organization-access.acl-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

const answering = (answer: unknown): AppQueryBus =>
  ({ execute: () => Promise.resolve(answer) }) as unknown as AppQueryBus;

describe("OrganizationAccessLive", () => {
  it("narrows the membership view to a boolean", async () => {
    deepStrictEqual(
      (
        await new OrganizationAccessLive(answering(Ok({ isMember: true }))).isMember(userId, orgId)
      ).unwrap(),
      true,
    );
    deepStrictEqual(
      (
        await new OrganizationAccessLive(answering(Ok({ isMember: false }))).isMember(userId, orgId)
      ).unwrap(),
      false,
    );
  });

  it("propagates the store outage as a typed failure", async () => {
    const result = await new OrganizationAccessLive(
      answering(Err(new PersistenceUnavailable({ message: "down" }))),
    ).isMember(userId, orgId);
    deepStrictEqual(result.unwrapErr()._tag, "PersistenceUnavailable");
  });
});
