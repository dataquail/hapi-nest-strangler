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

describe.sequential("POST /cli/orgs/{orgId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("creates a todo via the CLI surface and returns the CliTodo shape", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    const todo = await client.POST("/cli/orgs/{orgId}/todos", {
      params: { path: { orgId: org.data.id } },
      body: { title: "Buy milk" },
    });
    ok(todo.data !== undefined, JSON.stringify(todo.error));
    deepStrictEqual(todo.data.title, "Buy milk");
    deepStrictEqual(todo.data.completed, false);
    ok(typeof todo.data.id === "string" && todo.data.id.length > 0);
  });
});
