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

describe.sequential("POST /cli/orgs/{orgId}/todos/{id}/complete (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  const createOrg = async () => {
    const org = await runtime.server().client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    return org.data.id;
  };

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
