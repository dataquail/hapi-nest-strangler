import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const otherOrganizationId = "22222222-2222-2222-2222-222222222222";
const todoId = "33333333-3333-3333-3333-333333333333";

describe.sequential("PUT /internal/orgs/{organizationId}/todos/{id} (integration)", () => {
  const runtime = useServerTestRuntime(["todos.todos"]);

  const mirror = async () => {
    const res = await runtime.server().client.POST("/internal/orgs/{organizationId}/todos", {
      params: { path: { organizationId } },
      body: { id: todoId, title: "Buy milk" },
    });
    ok(res.data !== undefined, JSON.stringify(res.error));
  };

  it("overwrites title and completed as the legacy API has them", async () => {
    await mirror();
    const res = await runtime.server().client.PUT("/internal/orgs/{organizationId}/todos/{id}", {
      params: { path: { organizationId, id: todoId } },
      body: { title: "Buy oat milk", completed: true },
    });
    deepStrictEqual(res.response.status, 200);
    deepStrictEqual(res.data, {
      id: todoId,
      organizationId,
      title: "Buy oat milk",
      completed: true,
    });
  });

  it("returns 404 InternalTodoNotFoundError for an id never mirrored", async () => {
    const res = await runtime.server().client.PUT("/internal/orgs/{organizationId}/todos/{id}", {
      params: { path: { organizationId, id: todoId } },
      body: { title: "x", completed: false },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "InternalTodoNotFoundError");
  });

  it("returns 404 through another organization's path", async () => {
    await mirror();
    const res = await runtime.server().client.PUT("/internal/orgs/{organizationId}/todos/{id}", {
      params: { path: { organizationId: otherOrganizationId, id: todoId } },
      body: { title: "hijack", completed: true },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "InternalTodoNotFoundError");
  });
});
