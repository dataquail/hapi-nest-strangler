import { deepStrictEqual, ok } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { cookieFor, createSession, createUser, signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

describe.sequential("auth routes (integration)", () => {
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

  it("GET /auth/me reports the caller and whether they are a super admin", async () => {
    const member = await signedInAs("member@example.com");
    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const asMember = await server.inject({
      method: "GET",
      url: "/auth/me",
      headers: member.headers,
    });
    deepStrictEqual(JSON.parse(asMember.payload), { userId: member.userId, isSuperAdmin: false });
    const asAdmin = await server.inject({ method: "GET", url: "/auth/me", headers: admin.headers });
    deepStrictEqual(JSON.parse(asAdmin.payload), { userId: admin.userId, isSuperAdmin: true });
  });

  it("rejects an expired, a revoked and a forged session with 401", async () => {
    const userId = await createUser("u@example.com");
    const expired = await createSession(userId, { expires_at: new Date(Date.now() - 1000) });
    const revoked = await createSession(userId, { revoked_at: new Date() });
    for (const cookie of [cookieFor(expired), cookieFor(revoked), "session=forged.signature"]) {
      const res = await server.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
      deepStrictEqual(res.statusCode, 401, cookie);
    }
  });

  it("mints, lists, uses as a bearer, and revokes personal access tokens", async () => {
    const { headers, userId } = await signedInAs("me@example.com");
    const created = await server.inject({
      method: "POST",
      url: "/auth/tokens",
      headers,
      payload: { label: "laptop", expiresInDays: 30 },
    });
    deepStrictEqual(created.statusCode, 201);
    const minted = JSON.parse(created.payload);
    ok(minted.token.startsWith(`${minted.prefix}_`));

    const listed = JSON.parse(
      (await server.inject({ method: "GET", url: "/auth/tokens", headers })).payload,
    );
    deepStrictEqual(
      listed.map((t: any) => t.label),
      ["laptop"],
    );
    deepStrictEqual(Object.keys(listed[0]).includes("token"), false);

    const viaBearer = await server.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${minted.token}` },
    });
    deepStrictEqual(JSON.parse(viaBearer.payload).userId, userId);

    const revoked = await server.inject({
      method: "DELETE",
      url: `/auth/tokens/${minted.id}`,
      headers,
    });
    deepStrictEqual(revoked.statusCode, 204);
    const afterRevoke = await server.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${minted.token}` },
    });
    deepStrictEqual(afterRevoke.statusCode, 401);
  });

  it("hides another user's token behind 404", async () => {
    const owner = await signedInAs("owner@example.com");
    const other = await signedInAs("other@example.com");
    const minted = JSON.parse(
      (
        await server.inject({
          method: "POST",
          url: "/auth/tokens",
          headers: owner.headers,
          payload: { label: "x" },
        })
      ).payload,
    );
    const res = await server.inject({
      method: "DELETE",
      url: `/auth/tokens/${minted.id}`,
      headers: other.headers,
    });
    deepStrictEqual(res.statusCode, 404);
    deepStrictEqual(JSON.parse(res.payload)._tag, "NotFound");
  });

  it("runs the device flow: start, pending, approve in the browser, token", async () => {
    const start = JSON.parse(
      (await server.inject({ method: "POST", url: "/cli/device/start" })).payload,
    );
    deepStrictEqual(start.verification_uri, "http://app.test/device");
    ok(start.verification_uri_complete.endsWith(`?code=${encodeURIComponent(start.user_code)}`));

    const pending = await server.inject({
      method: "POST",
      url: "/cli/device/token",
      payload: { device_code: start.device_code },
    });
    deepStrictEqual(pending.statusCode, 400);
    deepStrictEqual(JSON.parse(pending.payload)._tag, "DeviceAuthorizationPending");

    const { headers, userId } = await signedInAs("browser@example.com");
    const approved = await server.inject({
      method: "POST",
      url: "/auth/device/approve",
      headers,
      payload: { userCode: start.user_code },
    });
    deepStrictEqual(approved.statusCode, 204);

    const exchanged = await server.inject({
      method: "POST",
      url: "/cli/device/token",
      payload: { device_code: start.device_code },
    });
    deepStrictEqual(exchanged.statusCode, 200);
    const token = JSON.parse(exchanged.payload);
    deepStrictEqual(token.token_type, "Bearer");
    const me = await server.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    deepStrictEqual(JSON.parse(me.payload).userId, userId);

    // Single use: the grant is gone.
    const again = await server.inject({
      method: "POST",
      url: "/cli/device/token",
      payload: { device_code: start.device_code },
    });
    deepStrictEqual(JSON.parse(again.payload)._tag, "DeviceCodeNotFound");
    deepStrictEqual((await getKnex()("device_grants")).length, 0);
  });

  it("answers 404 for an unknown user code and 410 for an expired one", async () => {
    const { headers } = await signedInAs("browser@example.com");
    const unknown = await server.inject({
      method: "POST",
      url: "/auth/device/approve",
      headers,
      payload: { userCode: "NOPE-NOPE" },
    });
    deepStrictEqual(unknown.statusCode, 404);
    await getKnex()("device_grants").insert({
      id: "11111111-1111-1111-1111-111111111111",
      device_code_hash: "hash",
      user_code: "OLDC-ODE1",
      status: "pending",
      expires_at: new Date(Date.now() - 1000),
    });
    const expired = await server.inject({
      method: "POST",
      url: "/auth/device/approve",
      headers,
      payload: { userCode: "OLDC-ODE1" },
    });
    deepStrictEqual(expired.statusCode, 410);
    deepStrictEqual(JSON.parse(expired.payload)._tag, "Gone");
  });

  it("GET /auth/logout revokes the session, clears the cookie and redirects to the IdP", async () => {
    const { headers, sessionId } = await signedInAs("bye@example.com");
    const res = await server.inject({ method: "GET", url: "/auth/logout", headers });
    deepStrictEqual(res.statusCode, 302);
    ok(String(res.headers["set-cookie"]).includes("session=;"));
    const row = await getKnex()("sessions").where({ id: sessionId }).first();
    ok(row.revoked_at !== null);
    const after = await server.inject({ method: "GET", url: "/auth/me", headers });
    deepStrictEqual(after.statusCode, 401);
  });
});
