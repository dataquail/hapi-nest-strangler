import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const todoId = "33333333-3333-3333-3333-333333333333";

describe.sequential(
  "POST /internal/orgs/{organizationId}/todos/{id}/complete (integration)",
  () => {
    const runtime = useServerTestRuntime(["todos.todos"]);

    const mirror = async () => {
      const res = await runtime.server().client.POST("/internal/orgs/{organizationId}/todos", {
        params: { path: { organizationId } },
        body: { id: todoId, title: "Buy milk" },
      });
      ok(res.data !== undefined, JSON.stringify(res.error));
    };

    it("marks the todo done and is idempotent", async () => {
      await mirror();
      const { client } = runtime.server();
      const first = await client.POST("/internal/orgs/{organizationId}/todos/{id}/complete", {
        params: { path: { organizationId, id: todoId } },
      });
      deepStrictEqual(first.response.status, 200);
      deepStrictEqual(first.data?.completed, true);
      deepStrictEqual(first.data?.title, "Buy milk");
      const again = await client.POST("/internal/orgs/{organizationId}/todos/{id}/complete", {
        params: { path: { organizationId, id: todoId } },
      });
      deepStrictEqual(again.response.status, 200);
      deepStrictEqual(again.data?.completed, true);
    });

    it("returns 404 InternalTodoNotFoundError for an id never mirrored", async () => {
      const res = await runtime
        .server()
        .client.POST("/internal/orgs/{organizationId}/todos/{id}/complete", {
          params: { path: { organizationId, id: todoId } },
        });
      deepStrictEqual(res.response.status, 404);
      deepStrictEqual(res.error?._tag, "InternalTodoNotFoundError");
    });
  },
);
