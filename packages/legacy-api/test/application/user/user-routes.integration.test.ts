import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

describe.sequential("user routes (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;

  beforeAll(async () => {
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await closeKnex();
  });

  beforeEach(truncateAll);

  it("creates, lists and deletes users for a signed-in caller", async () => {
    const { headers } = await signedInAs("caller@example.com");

    const created = await server.inject({
      method: "POST",
      url: "/users",
      headers,
      payload: { email: "new@example.com", country: "USA", street: "1 St", postalCode: "00000" },
    });
    deepStrictEqual(created.statusCode, 201);
    const { id } = JSON.parse(created.payload);

    const listed = await server.inject({
      method: "GET",
      url: "/users?page=1&pageSize=10",
      headers,
    });
    deepStrictEqual(listed.statusCode, 200);
    const body = JSON.parse(listed.payload);
    deepStrictEqual(body.total, 2);
    deepStrictEqual(body.users[0].email, "new@example.com");
    deepStrictEqual(body.users[0].address, { country: "USA", street: "1 St", postalCode: "00000" });

    const deleted = await server.inject({ method: "DELETE", url: `/users/${id}`, headers });
    deepStrictEqual(deleted.statusCode, 204);
    deepStrictEqual(await getKnex()("users").where({ id }).first(), undefined);
  });

  it("answers 409 UserAlreadyExistsError for a duplicate email", async () => {
    const { headers } = await signedInAs("caller@example.com");
    const res = await server.inject({
      method: "POST",
      url: "/users",
      headers,
      payload: { email: "caller@example.com", country: "USA", street: "1 St", postalCode: "00000" },
    });
    deepStrictEqual(res.statusCode, 409);
    deepStrictEqual(JSON.parse(res.payload)._tag, "UserAlreadyExistsError");
    deepStrictEqual(JSON.parse(res.payload).email, "caller@example.com");
  });

  it("answers 404 UserNotFoundError for an unknown id and 400 BadRequest for a bad one", async () => {
    const { headers } = await signedInAs("caller@example.com");
    const missing = await server.inject({
      method: "DELETE",
      url: "/users/00000000-0000-0000-0000-000000000000",
      headers,
    });
    deepStrictEqual(missing.statusCode, 404);
    deepStrictEqual(JSON.parse(missing.payload)._tag, "UserNotFoundError");
    const bad = await server.inject({ method: "DELETE", url: "/users/not-a-uuid", headers });
    deepStrictEqual(bad.statusCode, 400);
    deepStrictEqual(JSON.parse(bad.payload)._tag, "BadRequest");
  });

  it("answers 401 Unauthorized without a session", async () => {
    const res = await server.inject({ method: "GET", url: "/users?page=1&pageSize=10" });
    deepStrictEqual(res.statusCode, 401);
    deepStrictEqual(JSON.parse(res.payload)._tag, "Unauthorized");
  });
});
