import * as Hapi from "@hapi/hapi";

export const FAKE_IDP_PORT = 18080;

type Identity = { sub: string; email: string | null };

// A minimal OpenID provider on a fixed port: discovery, a token endpoint that
// hands out a signed id_token for whichever identity the test armed, the JWKS
// that verifies it, userinfo and end-session. Zitadel is never involved.
export const startFakeIdp = async () => {
  const { SignJWT, exportJWK, generateKeyPair } = await import("jose");
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  const issuer = `http://127.0.0.1:${FAKE_IDP_PORT}`;
  let identity: Identity = { sub: "idp-subject-1", email: "first@example.com" };
  let omitEmailFromIdToken = false;
  const tokenRequests: Array<Record<string, string>> = [];

  const server = Hapi.server({ port: FAKE_IDP_PORT, host: "127.0.0.1" });
  server.route([
    {
      method: "GET",
      path: "/.well-known/openid-configuration",
      handler: () => ({
        issuer,
        authorization_endpoint: `${issuer}/oauth/v2/authorize`,
        token_endpoint: `${issuer}/oauth/v2/token`,
        jwks_uri: `${issuer}/oauth/v2/keys`,
        userinfo_endpoint: `${issuer}/oidc/v1/userinfo`,
        end_session_endpoint: `${issuer}/oidc/v1/end_session`,
      }),
    },
    { method: "GET", path: "/oauth/v2/keys", handler: () => ({ keys: [jwk] }) },
    {
      method: "POST",
      path: "/oauth/v2/token",
      handler: async (request, h) => {
        const form = request.payload as Record<string, string>;
        tokenRequests.push({ ...form, authorization: String(request.headers.authorization ?? "") });
        if (form.code !== "good-code") return h.response({ error: "invalid_grant" }).code(400);
        const claims: Record<string, unknown> = { sub: identity.sub };
        if (identity.email !== null && !omitEmailFromIdToken) claims.email = identity.email;
        const idToken = await new SignJWT(claims)
          .setProtectedHeader({ alg: "RS256", kid: "test-key" })
          .setIssuer(issuer)
          .setAudience("test-client")
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        return { id_token: idToken, access_token: "access-token", token_type: "Bearer" };
      },
    },
    {
      method: "GET",
      path: "/oidc/v1/userinfo",
      handler: () =>
        identity.email === null
          ? { sub: identity.sub }
          : { sub: identity.sub, email: identity.email },
    },
  ]);
  await server.start();

  return {
    issuer,
    tokenRequests,
    arm: (next: Identity, options: { omitEmailFromIdToken?: boolean } = {}) => {
      identity = next;
      omitEmailFromIdToken = options.omitEmailFromIdToken ?? false;
    },
    stop: () => server.stop(),
  };
};
