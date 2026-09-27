import { deepStrictEqual, ok } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeIdp } from "../../helpers/fake-idp";
import { getServer } from "../../server";

const cookieHeaderFrom = (setCookie: string | string[] | undefined): string =>
  (Array.isArray(setCookie) ? setCookie : [setCookie ?? ""]).map((c) => c.split(";")[0]).join("; ");

describe.sequential("OIDC login (integration, against a fake IdP)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let idp: Awaited<ReturnType<typeof startFakeIdp>>;

  beforeAll(async () => {
    idp = await startFakeIdp();
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await idp.stop();
    await closeKnex();
  });

  beforeEach(truncateAll);

  const login = async () => {
    const res = await server.inject({ method: "GET", url: "/auth/login" });
    deepStrictEqual(res.statusCode, 302);
    const location = new URL(res.headers.location as string);
    deepStrictEqual(location.origin + location.pathname, `${idp.issuer}/oauth/v2/authorize`);
    deepStrictEqual(location.searchParams.get("code_challenge_method"), "S256");
    deepStrictEqual(location.searchParams.get("redirect_uri"), "http://app.test/api/auth/callback");
    const state = location.searchParams.get("state");
    ok(state);
    return { state, cookie: cookieHeaderFrom(res.headers["set-cookie"]) };
  };

  const callback = async (state: string, cookie: string, code = "good-code") =>
    server.inject({
      method: "GET",
      url: `/auth/callback?code=${code}&state=${encodeURIComponent(state)}`,
      headers: { cookie },
    });

  it("provisions a user on first login, links the identity, and sets a session cookie", async () => {
    idp.arm({ sub: "idp-subject-1", email: "first@example.com" });
    const { cookie, state } = await login();
    const res = await callback(state, cookie);
    deepStrictEqual(res.statusCode, 302);
    deepStrictEqual(res.headers.location, "http://app.test");
    const setCookie = res.headers["set-cookie"] as string[];
    ok(setCookie.some((c) => c.startsWith("session=") && c.includes("HttpOnly")));
    ok(setCookie.some((c) => c.startsWith("oidc_pkce=;")));

    const users = await getKnex()("users");
    deepStrictEqual(
      users.map((u) => u.email),
      ["first@example.com"],
    );
    const identities = await getKnex()("auth_identities");
    deepStrictEqual(identities[0].subject, "idp-subject-1");
    const me = await server.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: cookieHeaderFrom(setCookie) },
    });
    deepStrictEqual(JSON.parse(me.payload).userId, users[0].id);
    ok(idp.tokenRequests[0].authorization.startsWith("Basic "));
    deepStrictEqual(idp.tokenRequests[0].grant_type, "authorization_code");
  });

  it("reuses the linked user on a second login", async () => {
    idp.arm({ sub: "idp-subject-2", email: "second@example.com" });
    const first = await login();
    await callback(first.state, first.cookie);
    const second = await login();
    await callback(second.state, second.cookie);
    deepStrictEqual((await getKnex()("users")).length, 1);
    deepStrictEqual((await getKnex()("sessions")).length, 2);
  });

  it("falls back to userinfo when the id_token has no email", async () => {
    idp.arm({ sub: "idp-subject-3", email: "third@example.com" }, { omitEmailFromIdToken: true });
    const { cookie, state } = await login();
    deepStrictEqual((await callback(state, cookie)).statusCode, 302);
    deepStrictEqual((await getKnex()("users"))[0].email, "third@example.com");
  });

  it("refuses to provision an identity without an email, with an opaque 401", async () => {
    idp.arm({ sub: "idp-subject-4", email: null });
    const { cookie, state } = await login();
    const res = await callback(state, cookie);
    deepStrictEqual(res.statusCode, 401);
    deepStrictEqual(JSON.parse(res.payload).message, "Cannot provision a user for this identity.");
    deepStrictEqual((await getKnex()("users")).length, 0);
  });

  it("refuses a callback whose state does not match the cookie, or that has no cookie", async () => {
    idp.arm({ sub: "idp-subject-5", email: "five@example.com" });
    const { cookie } = await login();
    deepStrictEqual((await callback("someone-elses-state", cookie)).statusCode, 401);
    const noCookie = await server.inject({
      method: "GET",
      url: "/auth/callback?code=good-code&state=x",
    });
    deepStrictEqual(noCookie.statusCode, 401);
  });

  it("refuses a code the IdP rejects", async () => {
    idp.arm({ sub: "idp-subject-6", email: "six@example.com" });
    const { cookie, state } = await login();
    const res = await callback(state, cookie, "bad-code");
    deepStrictEqual(res.statusCode, 401);
  });
});
