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

describe.sequential("POST /cli/orgs/{orgId}/todos/{id}/complete (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  const createOrg = () =>
    seedMemberOrganization(runtime.server().database, MEMBER_CALLER_ID, "Acme");

  it("marks a todo done without resupplying its title", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg();
    const created = await client.POST("/cli/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title: "Buy milk" },
    });
    ok(created.data !== undefined, JSON.stringify(created.error));
    const completed = await client.POST("/cli/orgs/{orgId}/todos/{id}/complete", {
      params: { path: { orgId, id: created.data.id } },
    });
    ok(completed.data !== undefined, JSON.stringify(completed.error));
    deepStrictEqual(completed.data.completed, true);
    deepStrictEqual(completed.data.title, "Buy milk");
  });

  it("fails CliTodoNotFoundError for an unknown todo", async () => {
    const { client } = runtime.server();
    const orgId = await createOrg();
    const res = await client.POST("/cli/orgs/{orgId}/todos/{id}/complete", {
      params: { path: { orgId, id: "00000000-0000-0000-0000-000000000000" } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "CliTodoNotFoundError");
  });
});
