import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

describe.sequential("DELETE /users/{id} (integration)", () => {
  const runtime = useServerTestRuntime(["user.users"]);

  it("removes the user", async () => {
    const { client } = runtime.server();
    const created = await client.POST("/users", { body: basePayload });
    ok(created.data !== undefined, JSON.stringify(created.error));
    const deleted = await client.DELETE("/users/{id}", {
      params: { path: { id: created.data.id } },
    });
    deepStrictEqual(deleted.response.status, 204);
    const after = await client.GET("/users", { params: { query: { page: 1, pageSize: 10 } } });
    deepStrictEqual(after.data?.total, 0);
  });

  it("returns 404 UserNotFoundError for unknown id", async () => {
    const { client } = runtime.server();
    const res = await client.DELETE("/users/{id}", {
      params: { path: { id: "00000000-0000-0000-0000-000000000000" } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "UserNotFoundError");
  });
});
