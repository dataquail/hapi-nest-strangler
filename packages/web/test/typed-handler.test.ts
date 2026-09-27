import { UserContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { unwrap } from "@/services/api/api-error";
import { makeApiClient } from "@/services/api/client.shared";

import { makePaginatedUsers, makeUser } from "./fixtures/user";
import { server } from "./msw-server";
import { fail, ok, TEST_API_BASE, typedHandler } from "./typed-handler";

const client = () => makeApiClient({ baseUrl: TEST_API_BASE, headers: {} });

describe("typedHandler", () => {
  it("round-trips a GET with query params and a paginated success body", async () => {
    server.use(
      typedHandler(UserContract.Group.routes.find, ({ urlParams }) =>
        ok(
          makePaginatedUsers({
            users: [makeUser({ email: "alice@example.com" })],
            page: urlParams.page,
            total: 1,
          }),
        ),
      ),
    );
    const result = unwrap(
      await client().GET("/users", { params: { query: { page: 1, pageSize: 10 } } }),
    );
    expect(result.total).toBe(1);
    expect(result.users[0]?.email).toBe("alice@example.com");
  });

  it("round-trips a POST body", async () => {
    const newId = UserId.parse("22222222-2222-2222-2222-222222222222");
    server.use(
      typedHandler(UserContract.Group.routes.create, ({ payload }) => {
        expect(payload.email).toBe("bob@example.com");
        return ok({ id: newId });
      }),
    );
    const result = unwrap(
      await client().POST("/users", {
        body: { email: "bob@example.com", country: "US", street: "2 B St", postalCode: "10002" },
      }),
    );
    expect(result.id).toBe(newId);
  });

  it("encodes a declared error as its status and tagged body", async () => {
    server.use(
      typedHandler(UserContract.Group.routes.create, ({ payload }) =>
        fail(UserContract.UserAlreadyExistsError, {
          email: payload.email,
          message: "Email already in use",
        }),
      ),
    );
    const settled = await client().POST("/users", {
      body: {
        email: "duplicate@example.com",
        country: "US",
        street: "3 C St",
        postalCode: "10003",
      },
    });
    expect(settled.response.status).toBe(409);
    expect(settled.error).toMatchObject({
      _tag: "UserAlreadyExistsError",
      email: "duplicate@example.com",
    });
  });
});
