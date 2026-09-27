import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { FindUsersQuery } from "@/modules/user/queries/find-users.query.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

describe.sequential("POST /users (integration)", () => {
  const runtime = useServerTestRuntime(["user.users"]);

  it("creates a user and persists it", async () => {
    const { client, queryBus } = runtime.server();
    const res = await client.POST("/users", { body: basePayload });
    ok(res.data !== undefined, JSON.stringify(res.error));
    ok(typeof res.data.id === "string" && res.data.id.length > 0);

    // Persistence is verified through the production read seam: the query bus.
    const result = (await queryBus.execute(new FindUsersQuery({ page: 1, pageSize: 10 }))).unwrap();
    const stored = result.users.find((u) => u.email === basePayload.email);
    ok(stored !== undefined);
    deepStrictEqual(stored.id, res.data.id);
  });

  it("returns 409 UserAlreadyExistsError on duplicate email", async () => {
    const { client } = runtime.server();
    const first = await client.POST("/users", { body: basePayload });
    ok(first.data !== undefined, JSON.stringify(first.error));
    const res = await client.POST("/users", { body: basePayload });
    deepStrictEqual(res.response.status, 409);
    deepStrictEqual(res.error?._tag, "UserAlreadyExistsError");
    deepStrictEqual(res.error?.email, basePayload.email);
  });
});
