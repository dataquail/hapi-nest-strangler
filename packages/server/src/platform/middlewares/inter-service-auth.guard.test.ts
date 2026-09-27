import { deepStrictEqual, rejects } from "node:assert";

import { describe, it } from "vitest";

import { EnvVars } from "@/common/env-vars.js";
import { HttpProblem } from "@/platform/http/http-problem.js";
import { mintServiceToken, TEST_SERVICE_SECRET } from "@/test-utils/test-service-token.js";

import { InterServiceAuthGuard } from "./inter-service-auth.guard.js";

type GuardContext = Parameters<InterServiceAuthGuard["canActivate"]>[0];

const contextWith = (authorization: string | undefined): GuardContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  }) as unknown as GuardContext;

const guard = new InterServiceAuthGuard(
  EnvVars.load({
    DATABASE_URL: "postgres://unused",
    INTER_SERVICE_JWT_SECRET: TEST_SERVICE_SECRET,
  }),
);

const unauthorized = (error: unknown): boolean => {
  deepStrictEqual(HttpProblem.is(error), true);
  deepStrictEqual((error as HttpProblem).getStatus(), 401);
  return true;
};

describe("InterServiceAuthGuard", () => {
  it("admits a token signed with the shared secret", async () => {
    const token = await mintServiceToken();
    deepStrictEqual(await guard.canActivate(contextWith(`Bearer ${token}`)), true);
  });

  it("rejects a missing or malformed Authorization header with 401", async () => {
    await rejects(guard.canActivate(contextWith(undefined)), unauthorized);
    await rejects(guard.canActivate(contextWith("Basic abc")), unauthorized);
    await rejects(guard.canActivate(contextWith("Bearer ")), unauthorized);
  });

  it("rejects a token signed with another secret with 401", async () => {
    const token = await mintServiceToken({ secret: "not-the-shared-secret-but-long-enough-0000" });
    await rejects(guard.canActivate(contextWith(`Bearer ${token}`)), unauthorized);
  });

  it("rejects an expired token with 401", async () => {
    const token = await mintServiceToken({ expiresIn: "-1m" });
    await rejects(guard.canActivate(contextWith(`Bearer ${token}`)), unauthorized);
  });
});
