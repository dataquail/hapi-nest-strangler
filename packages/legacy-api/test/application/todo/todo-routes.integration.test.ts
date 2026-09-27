import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

type Session = Awaited<ReturnType<typeof signedInAs>>;

describe.sequential("todo routes (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let wallets: Awaited<ReturnType<typeof startFakeWalletServer>>;

  beforeAll(async () => {
    wallets = await startFakeWalletServer(config("/auth/interServiceJWTSecret"));
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await wallets.stop();
    await closeKnex();
  });

  beforeEach(truncateAll);

  const body = (res: { payload: string }) => JSON.parse(res.payload);
  const createOrg = async (owner: Session) =>
    body(
      await server.inject({
        method: "POST",
        url: "/orgs",
        headers: owner.headers,
        payload: { name: "Acme" },
      }),
    ).id as string;

  it("creates, lists, updates and deletes todos for a member, over HTTP and the CLI paths", async () => {
    const owner = await signedInAs("owner@example.com");
    const orgId = await createOrg(owner);

    const created = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/todos`,
      headers: owner.headers,
      payload: { title: "Buy milk" },
    });
    deepStrictEqual(created.statusCode, 201);
    const todo = body(created);
    deepStrictEqual(todo.completed, false);

    const listed = body(
      await server.inject({ method: "GET", url: `/orgs/${orgId}/todos`, headers: owner.headers }),
    );
    deepStrictEqual(listed, [todo]);

    const updated = body(
      await server.inject({
        method: "PUT",
        url: `/orgs/${orgId}/todos/${todo.id}`,
        headers: owner.headers,
        payload: { title: "Buy oat milk", completed: true },
      }),
    );
    deepStrictEqual(updated, { id: todo.id, title: "Buy oat milk", completed: true });

    const cliCreated = body(
      await server.inject({
        method: "POST",
        url: `/cli/orgs/${orgId}/todos`,
        headers: owner.headers,
        payload: { title: "From the CLI" },
      }),
    );
    const cliListed = body(
      await server.inject({
        method: "GET",
        url: `/cli/orgs/${orgId}/todos`,
        headers: owner.headers,
      }),
    );
    deepStrictEqual(cliListed.length, 2);
    const completed = body(
      await server.inject({
        method: "POST",
        url: `/cli/orgs/${orgId}/todos/${cliCreated.id}/complete`,
        headers: owner.headers,
      }),
    );
    deepStrictEqual(completed.completed, true);

    deepStrictEqual(
      (
        await server.inject({
          method: "DELETE",
          url: `/cli/orgs/${orgId}/todos/${cliCreated.id}`,
          headers: owner.headers,
        })
      ).statusCode,
      204,
    );
    deepStrictEqual(
      (
        await server.inject({
          method: "DELETE",
          url: `/orgs/${orgId}/todos/${todo.id}`,
          headers: owner.headers,
        })
      ).statusCode,
      204,
    );
    deepStrictEqual(await getKnex()("todos"), []);
  });

  it("answers 404 for an unknown todo and for a todo reached through another organization", async () => {
    const owner = await signedInAs("owner@example.com");
    const orgA = await createOrg(owner);
    const orgB = await createOrg(owner);
    const todo = body(
      await server.inject({
        method: "POST",
        url: `/orgs/${orgA}/todos`,
        headers: owner.headers,
        payload: { title: "A" },
      }),
    );
    const unknown = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgA}/todos/00000000-0000-0000-0000-000000000000`,
      headers: owner.headers,
    });
    deepStrictEqual(unknown.statusCode, 404);
    deepStrictEqual(body(unknown)._tag, "TodoNotFoundError");
    const crossed = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgB}/todos/${todo.id}`,
      headers: owner.headers,
    });
    deepStrictEqual(crossed.statusCode, 404);
    deepStrictEqual(body(crossed)._tag, "TodoNotFoundError");
    const cliCrossed = await server.inject({
      method: "POST",
      url: `/cli/orgs/${orgB}/todos/${todo.id}/complete`,
      headers: owner.headers,
    });
    deepStrictEqual(body(cliCrossed)._tag, "CliTodoNotFoundError");
    deepStrictEqual((await getKnex()("todos")).length, 1);
  });

  it("forbids a non-member and admits a super admin", async () => {
    const owner = await signedInAs("owner@example.com");
    const stranger = await signedInAs("stranger@example.com");
    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const orgId = await createOrg(owner);
    const todo = body(
      await server.inject({
        method: "POST",
        url: `/orgs/${orgId}/todos`,
        headers: owner.headers,
        payload: { title: "A" },
      }),
    );

    deepStrictEqual(
      (
        await server.inject({
          method: "GET",
          url: `/orgs/${orgId}/todos`,
          headers: stranger.headers,
        })
      ).statusCode,
      403,
    );
    deepStrictEqual(
      (
        await server.inject({
          method: "POST",
          url: `/orgs/${orgId}/todos`,
          headers: stranger.headers,
          payload: { title: "x" },
        })
      ).statusCode,
      403,
    );
    deepStrictEqual(
      (
        await server.inject({
          method: "DELETE",
          url: `/orgs/${orgId}/todos/${todo.id}`,
          headers: stranger.headers,
        })
      ).statusCode,
      403,
    );
    deepStrictEqual(
      (await server.inject({ method: "GET", url: `/orgs/${orgId}/todos`, headers: admin.headers }))
        .statusCode,
      200,
    );
    deepStrictEqual(
      (
        await server.inject({
          method: "DELETE",
          url: `/orgs/${orgId}/todos/${todo.id}`,
          headers: admin.headers,
        })
      ).statusCode,
      204,
    );
  });
});
