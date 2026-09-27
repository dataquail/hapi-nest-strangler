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

const stub = (opts: {
  readonly isMember?: boolean;
  readonly roles?: ReadonlyArray<string>;
}): AppQueryBus =>
  ({
    execute: (query: { constructor: { name: string } }) =>
      Promise.resolve(
        query.constructor.name === "FindMembershipQuery"
          ? Ok({ isMember: opts.isMember ?? false })
          : Ok({ userId, organizationId: orgId, roles: opts.roles ?? [] }),
      ),
  }) as unknown as AppQueryBus;

describe("OrganizationAccessLive (billing)", () => {
  it("isMember reflects the organization module's membership answer", async () => {
    deepStrictEqual(
      (await new OrganizationAccessLive(stub({ isMember: true })).isMember(userId, orgId)).unwrap(),
      true,
    );
    deepStrictEqual(
      (
        await new OrganizationAccessLive(stub({ isMember: false })).isMember(userId, orgId)
      ).unwrap(),
      false,
    );
  });

  it("isAdmin narrows the org's role list to the admin role", async () => {
    deepStrictEqual(
      (
        await new OrganizationAccessLive(stub({ roles: ["admin"] })).isAdmin(userId, orgId)
      ).unwrap(),
      true,
    );
    deepStrictEqual(
      (await new OrganizationAccessLive(stub({ roles: [] })).isAdmin(userId, orgId)).unwrap(),
      false,
    );
    deepStrictEqual(
      (
        await new OrganizationAccessLive(stub({ roles: ["billing_viewer"] })).isAdmin(userId, orgId)
      ).unwrap(),
      false,
    );
  });

  it("a member who is not an admin may read but not mutate", async () => {
    const access = new OrganizationAccessLive(stub({ isMember: true, roles: [] }));
    deepStrictEqual((await access.isMember(userId, orgId)).unwrap(), true);
    deepStrictEqual((await access.isAdmin(userId, orgId)).unwrap(), false);
  });

  it("propagates the store outage as a typed failure", async () => {
    const failing = {
      execute: () => Promise.resolve(Err(new PersistenceUnavailable({ message: "down" }))),
    } as unknown as AppQueryBus;
    deepStrictEqual(
      (await new OrganizationAccessLive(failing).isAdmin(userId, orgId)).unwrapErr()._tag,
      "PersistenceUnavailable",
    );
  });
});
