import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

type Session = Awaited<ReturnType<typeof signedInAs>>;

const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const todoId = "11111111-1111-1111-1111-111111111111";
const todo = { id: todoId, title: "Buy milk", completed: false };

// Every todo route forwards to the Nest server and relays its answer; these
// tests hold the forward and the relay, not what the Nest server does.
describe.sequential("todo routes (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let nest: Awaited<ReturnType<typeof startFakeWalletServer>>;
  let owner: Session;

  beforeAll(async () => {
    nest = await startFakeWalletServer(config("/auth/interServiceJWTSecret"));
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await nest.stop();
    await closeKnex();
  });

  beforeEach(async () => {
    await truncateAll();
    owner = await signedInAs("owner@example.com");
    nest.calls.length = 0;
    nest.userApiAnswers(200, todo);
  });

  const body = (res: { payload: string }) => JSON.parse(res.payload);

  const routes = [
    { method: "GET", url: `/orgs/${orgId}/todos`, payload: undefined, answer: [todo] },
    { method: "POST", url: `/orgs/${orgId}/todos`, payload: { title: "Buy milk" }, answer: todo },
    {
      method: "PUT",
      url: `/orgs/${orgId}/todos/${todoId}`,
      payload: { title: "Buy oat milk", completed: true },
      answer: { ...todo, title: "Buy oat milk", completed: true },
    },
    { method: "DELETE", url: `/orgs/${orgId}/todos/${todoId}`, payload: undefined, answer: null },
    { method: "GET", url: `/cli/orgs/${orgId}/todos`, payload: undefined, answer: [todo] },
    {
      method: "POST",
      url: `/cli/orgs/${orgId}/todos`,
      payload: { title: "From the CLI" },
      answer: { ...todo, title: "From the CLI" },
    },
    {
      method: "POST",
      url: `/cli/orgs/${orgId}/todos/${todoId}/complete`,
      payload: undefined,
      answer: { ...todo, completed: true },
    },
    {
      method: "DELETE",
      url: `/cli/orgs/${orgId}/todos/${todoId}`,
      payload: undefined,
      answer: null,
    },
  ] as const;

  for (const route of routes) {
    it(`forwards ${route.method} ${route.url} with the caller's session and relays the answer`, async () => {
      nest.userApiAnswers(route.answer === null ? 204 : 200, route.answer);
      const res = await server.inject({
        method: route.method,
        url: route.url,
        headers: owner.headers,
        payload: route.payload,
      });
      deepStrictEqual(res.statusCode, route.answer === null ? 204 : 200);
      if (route.answer !== null) deepStrictEqual(body(res), route.answer);

      const forwarded = await nest.waitForCall(
        (call) => call.method === route.method && call.path === route.url,
      );
      deepStrictEqual(forwarded.cookie, owner.headers.cookie);
      deepStrictEqual(forwarded.authorization, "");
      deepStrictEqual(forwarded.payload ?? undefined, route.payload);
    });
  }

  it("relays a refusal as it is and writes nothing to its own table", async () => {
    nest.userApiAnswers(403, { _tag: "Forbidden", message: "not a member" });
    const refused = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/todos`,
      headers: owner.headers,
      payload: { title: "Buy milk" },
    });
    deepStrictEqual(refused.statusCode, 403);
    deepStrictEqual(body(refused), { _tag: "Forbidden", message: "not a member" });
    deepStrictEqual(await getKnex()("todos"), []);
  });

  it("forwards without a session too: the Nest server is the one to refuse", async () => {
    nest.userApiAnswers(401, { _tag: "Unauthorized" });
    const res = await server.inject({ method: "GET", url: `/orgs/${orgId}/todos` });
    deepStrictEqual(res.statusCode, 401);
    const forwarded = await nest.waitForCall((call) => call.path === `/orgs/${orgId}/todos`);
    deepStrictEqual(forwarded.cookie, "");
  });
});
