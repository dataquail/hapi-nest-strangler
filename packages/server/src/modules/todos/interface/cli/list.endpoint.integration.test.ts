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

describe.sequential("GET /cli/orgs/{orgId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(TODO_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("lists the org's todos via the CLI surface", async () => {
    const { client } = runtime.server();
    const org = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(org.data !== undefined, JSON.stringify(org.error));
    const orgId = org.data.id;
    const empty = await client.GET("/cli/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(empty.data?.length, 0);
    const created = await client.POST("/cli/orgs/{orgId}/todos", {
      params: { path: { orgId } },
      body: { title: "Buy milk" },
    });
    ok(created.data !== undefined, JSON.stringify(created.error));
    const todos = await client.GET("/cli/orgs/{orgId}/todos", { params: { path: { orgId } } });
    deepStrictEqual(
      todos.data?.map((t) => t.id),
      [created.data.id],
    );
  });
});
