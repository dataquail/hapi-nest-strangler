import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

describe.sequential("GET /users (integration)", () => {
  const runtime = useServerTestRuntime(["user.users"]);

  it("returns a paginated list after creates", async () => {
    const { client } = runtime.server();
    ok((await client.POST("/users", { body: basePayload })).data !== undefined);
    ok(
      (await client.POST("/users", { body: { ...basePayload, email: "bob@example.com" } })).data !==
        undefined,
    );
    const res = await client.GET("/users", { params: { query: { page: 1, pageSize: 10 } } });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data.page, 1);
    deepStrictEqual(res.data.pageSize, 10);
    deepStrictEqual(res.data.total, 2);
    deepStrictEqual(res.data.users.length, 2);
    deepStrictEqual(res.data.users.map((u) => u.email).sort(), [
      "alice@example.com",
      "bob@example.com",
    ]);
  });
});
