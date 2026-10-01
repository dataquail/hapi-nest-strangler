import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const otherOrganizationId = "22222222-2222-2222-2222-222222222222";
const todoId = "33333333-3333-3333-3333-333333333333";

describe.sequential("DELETE /internal/orgs/{organizationId}/todos/{id} (integration)", () => {
  const runtime = useServerTestRuntime(["todos.todos"]);

  const mirror = async () => {
    const res = await runtime.server().client.POST("/internal/orgs/{organizationId}/todos", {
      params: { path: { organizationId } },
      body: { id: todoId, title: "Buy milk" },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
  };

  it("removes the mirrored todo, after which a second delete is 404", async () => {
    await mirror();
    const { client } = runtime.server();
    const deleted = await client.DELETE("/internal/orgs/{organizationId}/todos/{id}", {
      params: { path: { organizationId, id: todoId } },
    });
    deepStrictEqual(deleted.response.status, 204);
    const again = await client.DELETE("/internal/orgs/{organizationId}/todos/{id}", {
      params: { path: { organizationId, id: todoId } },
    });
    deepStrictEqual(again.response.status, 404);
    deepStrictEqual(again.error?._tag, "InternalTodoNotFoundError");
  });

  it("returns 404 through another organization's path and leaves the todo", async () => {
    await mirror();
    const { client } = runtime.server();
    const res = await client.DELETE("/internal/orgs/{organizationId}/todos/{id}", {
      params: { path: { organizationId: otherOrganizationId, id: todoId } },
    });
    deepStrictEqual(res.response.status, 404);
    const stillThere = await client.POST("/internal/orgs/{organizationId}/todos/{id}/complete", {
      params: { path: { organizationId, id: todoId } },
    });
    deepStrictEqual(stillThere.response.status, 200);
  });
});
