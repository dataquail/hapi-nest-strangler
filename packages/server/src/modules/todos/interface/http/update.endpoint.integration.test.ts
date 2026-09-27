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

describe.sequential("PUT /orgs/{orgId}/todos/{id} (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  const createOrg = async (name: string) => {
    const org = await runtime.server().client.POST("/orgs", { body: { name } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    return org.data.id;
  };

  const createTodo = async (orgId: string, title: string) => {
    const res = await runtime.server().client.POST("/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
    return res.data;
  };

  it("updates title and completed", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg("Acme");
    const created = await createTodo(orgId, "Buy milk");
    const updated = await client.PUT("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: created.id } },
      body: { title: "Buy oat milk", completed: true },
    });
    ok(updated.data !== undefined, JSON.stringify(updated.error));
    deepStrictEqual(updated.data.title, "Buy oat milk");
    deepStrictEqual(updated.data.completed, true);
  });

  it("returns 404 TodoNotFoundError for an unknown id", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg("Acme");
    const res = await client.PUT("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: "00000000-0000-0000-0000-000000000000" } },
      body: { title: "x", completed: false },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "TodoNotFoundError");
  });

  it("returns 404 when updating via a different org's path (tenant isolation)", async () => {
    const { client } = runtime.server();
    const orgA = await createOrg("Acme");
    const orgB = await createOrg("Beta");
    const created = await createTodo(orgA, "Buy milk");
    // The repository is scoped by (orgId, todoId), so a todo created in orgA
    // cannot be reached through orgB's path.
    const res = await client.PUT("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId: orgB, id: created.id } },
      body: { title: "hijack", completed: true },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "TodoNotFoundError");
  });

  it("returns 403 Forbidden for a caller who isn't a member of the todo's org", async () => {
    const { client, database } = runtime.server();
    const orgId = "11111111-1111-1111-1111-111111111111";
    const todoId = "33333333-3333-3333-3333-333333333333";
    await database.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES (${orgId}, 'Acme', now(), now(), null)
    `);
    await database.exec(sql.unsafe`
      INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
      VALUES (${todoId}, ${orgId}, 'Someone else''s todo', false, now(), now())
    `);
    const res = await client.PUT("/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: todoId } },
      body: { title: "Hijacked", completed: false },
    });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
