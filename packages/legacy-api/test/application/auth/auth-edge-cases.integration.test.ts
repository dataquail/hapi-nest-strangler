import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { hashCredential } from "../../../src/application/auth/token-utils";
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

describe.sequential("auth edge cases (integration)", () => {
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

  const body = (res: { payload: string }) => JSON.parse(res.payload);
  const me = (token: string) =>
    server.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });

  it("refuses an unknown and an expired bearer token, and a second revoke of the same token", async () => {
    const { headers } = await signedInAs("me@example.com");
    deepStrictEqual((await me("pat_nobody_knows_this")).statusCode, 401);

    const minted = body(
      await server.inject({
        method: "POST",
        url: "/auth/tokens",
        headers,
        payload: { label: "laptop" },
      }),
    );
    deepStrictEqual((await me(minted.token)).statusCode, 200);
    await getKnex()("api_tokens")
      .where({ id: minted.id })
      .update({ expires_at: new Date(Date.now() - 1000) });
    deepStrictEqual((await me(minted.token)).statusCode, 401);

    deepStrictEqual(
      (await server.inject({ method: "DELETE", url: `/auth/tokens/${minted.id}`, headers }))
        .statusCode,
      204,
    );
    const twice = await server.inject({
      method: "DELETE",
      url: `/auth/tokens/${minted.id}`,
      headers,
    });
    deepStrictEqual(twice.statusCode, 404);
  });

  it("refuses a device token exchange for an unknown code, and drops an expired grant", async () => {
    const unknown = await server.inject({
      method: "POST",
      url: "/cli/device/token",
      payload: { device_code: "nope" },
    });
    deepStrictEqual(unknown.statusCode, 400);
    deepStrictEqual(body(unknown)._tag, "DeviceCodeNotFound");

    await getKnex()("device_grants").insert({
      id: "22222222-2222-2222-2222-222222222222",
      device_code_hash: hashCredential("stale-device-code"),
      user_code: "STAL-ECOD",
      status: "pending",
      expires_at: new Date(Date.now() - 1000),
    });
    const expired = await server.inject({
      method: "POST",
      url: "/cli/device/token",
      payload: { device_code: "stale-device-code" },
    });
    deepStrictEqual(expired.statusCode, 400);
    deepStrictEqual(body(expired)._tag, "DeviceTokenExpired");
    deepStrictEqual((await getKnex()("device_grants")).length, 0);
  });
});
