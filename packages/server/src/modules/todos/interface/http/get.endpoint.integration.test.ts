import { deepStrictEqual, ok } from "node:assert";

import { sql } from "@org/database";
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

describe.sequential("GET /orgs/{orgId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("lists only the org's todos, created_at desc", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    const orgId = org.data.id;

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
    const orgId = "11111111-1111-1111-1111-111111111111";
    await database.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES (${orgId}, 'Acme', now(), now(), null)
    `);
    const res = await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
