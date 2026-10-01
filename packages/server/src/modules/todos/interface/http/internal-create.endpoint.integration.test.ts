import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const todoId = "33333333-3333-3333-3333-333333333333";

describe.sequential("POST /internal/orgs/{organizationId}/todos (integration)", () => {
  const runtime = useServerTestRuntime(["todos.todos"]);

  it("mirrors a todo under the id the legacy API gave it", async () => {
    const res = await runtime.server().client.POST("/internal/orgs/{organizationId}/todos", {
      params: { path: { organizationId } },
      body: { id: todoId, title: "Buy milk" },
    });
    deepStrictEqual(res.response.status, 201);
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data, { id: todoId, organizationId, title: "Buy milk", completed: false });
  });

  it("returns 409 InternalTodoAlreadyExistsError when the id was mirrored before", async () => {
    const { client } = runtime.server();
    const body = { id: todoId, title: "Buy milk" };
    await client.POST("/internal/orgs/{organizationId}/todos", {
      params: { path: { organizationId } },
      body,
    });
    const again = await client.POST("/internal/orgs/{organizationId}/todos", {
      params: { path: { organizationId } },
      body,
    });
    deepStrictEqual(again.response.status, 409);
    deepStrictEqual(again.error?._tag, "InternalTodoAlreadyExistsError");
  });

  it("returns 400 BadRequest for a body without an id", async () => {
    const res = await runtime.server().client.POST("/internal/orgs/{organizationId}/todos", {
      params: { path: { organizationId } },
      body: { title: "Buy milk" } as { id: string; title: string },
    });
    deepStrictEqual(res.response.status, 400);
    deepStrictEqual(res.error?._tag, "BadRequest");
  });

  it("returns 401 Unauthorized without the inter-service token", async () => {
    const res = await fetch(`${runtime.server().baseUrl}/internal/orgs/${organizationId}/todos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: todoId, title: "Buy milk" }),
    });
    deepStrictEqual(res.status, 401);
    deepStrictEqual(((await res.json()) as { _tag: string })._tag, "Unauthorized");
  });
});
