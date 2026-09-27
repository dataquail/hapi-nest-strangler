import { deepStrictEqual } from "node:assert";

import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { UserId } from "@/platform/ids/user-id.js";

import { UsersLookupLive } from "./users-lookup.acl-live.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");

describe("UsersLookupLive", () => {
  it("translates the user module's view into the lookup view", async () => {
    const bus = {
      execute: () =>
        Promise.resolve(
          Ok([
            {
              id: alice,
              email: "a@x.io",
              address: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        ),
    } as unknown as AppQueryBus;
    deepStrictEqual((await new UsersLookupLive(bus).findByIds([alice])).unwrap(), [
      { userId: alice, email: "a@x.io" },
    ]);
  });
});
