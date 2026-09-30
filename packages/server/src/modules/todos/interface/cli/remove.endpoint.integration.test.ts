import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { seedMemberOrganization } from "@/test-utils/test-legacy-rows.js";

const TODO_TABLES = [
  "todos.todos",
  "public.memberships",
  "public.organizations",
  "public.roles",
  "public.users",
] as const;

describe.sequential("DELETE /cli/orgs/{orgId}/todos/{id} (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  const createOrg = () =>
    seedMemberOrganization(runtime.server().database, MEMBER_CALLER_ID, "Acme");

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
