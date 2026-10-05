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

describe.sequential("POST /orgs/{orgId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("creates a todo in the org and returns the persisted shape", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedMemberOrganization(database, MEMBER_CALLER_ID, "Acme");
    const res = await client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title: "Buy milk" },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    ok(res.data.id.length > 0);
    deepStrictEqual(res.data.title, "Buy milk");
    deepStrictEqual(res.data.completed, false);
  });

  it("returns 403 Forbidden for a caller who is not a member of the org", async () => {
    const { client, database } = runtime.server();
    const orgId = await seedLegacyOrganization(database, "Acme");
    const res = await client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title: "Buy milk" },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
