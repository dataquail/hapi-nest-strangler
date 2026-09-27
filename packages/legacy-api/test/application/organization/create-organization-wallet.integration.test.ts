import { deepStrictEqual, ok } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

describe.sequential("POST /orgs opens a wallet on the Nest server (integration)", () => {
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

  beforeEach(async () => {
    await truncateAll();
    wallets.calls.length = 0;
    wallets.refuseNextCreates(false);
  });

  it("creates the wallet over HTTP with a valid inter-service token, inside the request", async () => {
    const owner = await signedInAs("owner@example.com");
    const res = await server.inject({
      method: "POST",
      url: "/orgs",
      headers: owner.headers,
      payload: { name: "Acme" },
    });
    deepStrictEqual(res.statusCode, 201);
    const { id } = JSON.parse(res.payload);
    deepStrictEqual(wallets.calls.length, 1);
    deepStrictEqual(wallets.calls[0].method, "POST");
    deepStrictEqual(wallets.calls[0].path, "/internal/wallets");
    deepStrictEqual(wallets.calls[0].payload, { organizationId: id });
    ok(wallets.calls[0].tokenValid, "the token must verify with the shared secret");
    deepStrictEqual((await getKnex()("organizations").where({ id })).length, 1);
  });

  it("rolls the organization back and answers 502 when the wallet service refuses", async () => {
    const owner = await signedInAs("owner@example.com");
    wallets.refuseNextCreates(true);
    const res = await server.inject({
      method: "POST",
      url: "/orgs",
      headers: owner.headers,
      payload: { name: "Acme" },
    });
    deepStrictEqual(res.statusCode, 502);
    deepStrictEqual(JSON.parse(res.payload)._tag, "BadGateway");
    deepStrictEqual(await getKnex()("organizations"), []);
    deepStrictEqual(await getKnex()("memberships"), []);
    deepStrictEqual(await getKnex()("organization_roles"), []);
    // Nothing to compensate: the wallet was never opened.
    deepStrictEqual(
      wallets.calls.map((c) => c.method),
      ["POST"],
    );
  });
});
