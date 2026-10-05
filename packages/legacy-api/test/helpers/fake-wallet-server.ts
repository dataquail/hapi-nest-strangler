import * as Hapi from "@hapi/hapi";

export const FAKE_WALLET_PORT = 18081;

type Canned = { status: number; body: unknown };

type Recorded = {
  method: string;
  path: string;
  authorization: string;
  cookie: string;
  payload: unknown;
  tokenValid: boolean;
};

// Stands in for the Nest server's internal API on a fixed port: records every
// call, verifies the inter-service token the way the real guard does, and can
// be armed to refuse the next wallet create or every billing mirror, and
// relays whatever a test arms for the user-facing routes proxied to it.
export const startFakeWalletServer = async (sharedSecret: string) => {
  const { jwtVerify } = await import("jose");
  const key = new TextEncoder().encode(sharedSecret);
  const calls: Recorded[] = [];
  let refuseCreates = false;
  let refuseMirrors = false;

  const record = async (request: Hapi.Request) => {
    const authorization = String(request.headers.authorization ?? "");
    let tokenValid = false;
    if (authorization.startsWith("Bearer ")) {
      try {
        await jwtVerify(authorization.slice("Bearer ".length), key, { algorithms: ["HS256"] });
        tokenValid = true;
      } catch {
        tokenValid = false;
      }
    }
    calls.push({
      method: request.method.toUpperCase(),
      path: request.path,
      authorization,
      cookie: String(request.headers.cookie ?? ""),
      payload: request.payload,
      tokenValid,
    });
    return tokenValid;
  };

  // The user-facing API the legacy routes proxy to: answers whatever the test
  // last armed, so a test asserts on the forward and the relay, not on Nest's
  // behaviour.
  let userApiAnswer: Canned = { status: 200, body: {} };
  const relay: Hapi.Lifecycle.Method = async (request, h) => {
    await record(request);
    const reply = h.response(JSON.stringify(userApiAnswer.body)).code(userApiAnswer.status);
    return reply.type("application/json");
  };

  const server = Hapi.server({ port: FAKE_WALLET_PORT, host: "127.0.0.1" });
  const mirror: Hapi.Lifecycle.Method = async (request, h) => {
    const ok = await record(request);
    if (!ok) return h.response({ _tag: "Unauthorized" }).code(401);
    if (refuseMirrors)
      return h.response({ _tag: "ServiceUnavailable", message: "billing store down" }).code(503);
    return request.payload === null
      ? h.response().code(204)
      : h.response(request.payload).code(request.method === "post" ? 201 : 200);
  };

  server.route([
    { method: "*", path: "/orgs/{rest*}", handler: relay },
    {
      method: ["POST", "PUT"],
      path: "/internal/orgs/{organizationId}/billing/{rest*}",
      handler: mirror,
    },
    { method: "POST", path: "/internal/billing/{rest*}", handler: mirror },
    {
      method: "POST",
      path: "/internal/wallets",
      handler: async (request, h) => {
        const ok = await record(request);
        if (!ok) return h.response({ _tag: "Unauthorized" }).code(401);
        if (refuseCreates)
          return h.response({ _tag: "ServiceUnavailable", message: "wallet store down" }).code(503);
        const { organizationId } = request.payload as { organizationId: string };
        return h
          .response({ id: "11111111-1111-1111-1111-111111111111", organizationId, balance: 0 })
          .code(201);
      },
    },
    {
      method: "DELETE",
      path: "/internal/wallets/{organizationId}",
      handler: async (request, h) => {
        const ok = await record(request);
        return h.response().code(ok ? 204 : 401);
      },
    },
  ]);
  await server.start();

  return {
    calls,
    refuseNextCreates: (value: boolean) => {
      refuseCreates = value;
    },
    userApiAnswers: (status: number, body: unknown) => {
      userApiAnswer = { status, body };
    },
    refuseMirrors: (value: boolean) => {
      refuseMirrors = value;
    },
    // The mirror runs after the response, so a test waits for the call to land.
    waitForCall: async (predicate: (call: Recorded) => boolean): Promise<Recorded> => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const found = calls.find(predicate);
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error("the fake Nest server never received the expected call");
    },
    stop: () => server.stop(),
  };
};
