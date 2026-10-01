import { deepStrictEqual, ok } from "node:assert";

import { sql } from "@org/database";
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

describe.sequential("DELETE /orgs/{orgId}/todos/{id} (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  const createOrg = (name: string) =>
    seedMemberOrganization(runtime.server().database, MEMBER_CALLER_ID, name);

  const createTodo = async (orgId: string, title: string) => {
    const res = await runtime.server().client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    return res.data;
  };

  it("removes the todo", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg("Acme");
    const created = await createTodo(orgId, "Buy milk");
    const deleted = await client.DELETE("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: created.id } },
    });
    deepStrictEqual(deleted.response.status, 204);
    const todos = await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(todos.data?.length, 0);
  });

  it("returns 404 TodoNotFoundError for an unknown id", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg("Acme");
    const res = await client.DELETE("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: "00000000-0000-0000-0000-000000000000" } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "TodoNotFoundError");
  });

  it("returns 404 when deleting via a different org's path (tenant isolation)", async () => {
    const { client } = runtime.server();
    const orgA = await createOrg("Acme");
    const orgB = await createOrg("Beta");
    const created = await createTodo(orgA, "Buy milk");
    const res = await client.DELETE("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId: orgB, id: created.id } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "TodoNotFoundError");
    // The todo is still present under its real org.
    const todos = await client.GET("/orgs/{orgId}/todos", { params: { path: { orgId: orgA } } });
    deepStrictEqual(todos.data?.length, 1);
  });

  it("returns 403 Forbidden for a caller who isn't a member of the todo's org", async () => {
    const { client, database } = runtime.server();
    // Seeded directly: the caller cannot reach the create endpoints for an org
    // they are not a member of, and the resolver must find a real todo so the
    // denial comes from the policy rather than from NotFound.
    const orgId = await seedLegacyOrganization(database, "Acme");
    const todoId = "33333333-3333-3333-3333-333333333333";
    await database.exec(sql.unsafe`
      INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
      VALUES (${todoId}, ${orgId}, 'Someone else''s todo', false, now(), now())
    `);
    const res = await client.DELETE("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: todoId } },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
