import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { seedLegacyOrganization, seedMemberOrganization } from "@/test-utils/test-legacy-rows.js";

const TODO_TABLES = [
  "todos.todos",
  "public.memberships",
  "public.organizations",
  "public.roles",
  "public.users",
] as const;

describe.sequential("GET /orgs/{orgId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("lists only the org's todos, created_at desc", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedMemberOrganization(database, MEMBER_CALLER_ID, "Acme");

    const empty = await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(empty.data?.length, 0);

    for (const title of ["first", "second", "third"]) {
      const created = await client.POST("/orgs/{orgId}/todos", {
        params: { path: { orgId } },
        body: { title },
      });
      ok(created.data !== undefined, JSON.stringify(created.error));
    }

    const todos = await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(
      todos.data?.map((t) => t.title),
      ["third", "second", "first"],
    );
  });

  // A non-member caller (not super-admin) is rejected before any query.
  it("returns 403 Forbidden for a caller who isn't a member of the org", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedLegacyOrganization(database, "Acme");
    const res = await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
