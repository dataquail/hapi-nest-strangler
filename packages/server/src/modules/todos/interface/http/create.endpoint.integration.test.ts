import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TODO_TABLES = [
  "todos.todos",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describe.sequential("POST /orgs/{orgId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("creates a todo in the org and returns the persisted shape", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    const res = await client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId: org.data.id } },
      body: { title: "Buy milk" },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    ok(res.data.id.length > 0);
    deepStrictEqual(res.data.title, "Buy milk");
    deepStrictEqual(res.data.completed, false);
  });

  it("returns 403 Forbidden for a caller who is not a member of the org", async () => {
    const { client, database } = runtime.server();
    const { sql } = await import("@org/database");
    const orgId = "11111111-1111-1111-1111-111111111111";
    await database.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES (${orgId}, 'Acme', now(), now(), null)
    `);
    const res = await client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title: "Buy milk" },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
