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

describe.sequential("DELETE /cli/orgs/{orgId}/todos/{id} (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  const createOrg = async () => {
    const org = await runtime.server().client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    return org.data.id;
  };

  it("removes a todo so it drops out of the listing", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg();
    const created = await client.POST("/cli/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title: "Buy milk" },
    });
    ok(created.data !== undefined, JSON.stringify(created.error));
    const removed = await client.DELETE("/cli/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: created.data.id } },
    });
    deepStrictEqual(removed.response.status, 204);
    const todos = await client.GET("/cli/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(todos.data?.length, 0);
  });

  it("fails CliTodoNotFoundError for an unknown todo", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg();
    const res = await client.DELETE("/cli/orgs/{orgId}/todos/{id}", {
      params: { path: { orgId, id: "00000000-0000-0000-0000-000000000000" } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "CliTodoNotFoundError");
  });
});
