import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import type { Authenticator } from "@/platform/auth/authenticator.js";
import type { AuthenticatedRequest } from "@/platform/auth/caller.decorator.js";
import { UserId } from "@/platform/ids/user-id.js";

import { UserAuthGuard } from "./user-auth.guard.js";

type GuardContext = Parameters<UserAuthGuard["canActivate"]>[0];
type CurrentUser = Awaited<ReturnType<Authenticator["fromBearer"]>>;

const bearerCaller: CurrentUser = {
  sessionId: "token-1",
  userId: UserId.parse("00000000-0000-0000-0000-000000000001"),
};
const cookieCaller: CurrentUser = {
  sessionId: "session-1",
  userId: UserId.parse("00000000-0000-0000-0000-000000000002"),
};

const authenticator: Authenticator = {
  fromBearer: (token) =>
    Promise.resolve(token === "good" ? bearerCaller : Promise.reject(new Error("bad bearer"))),
  fromSessionCookie: (header) =>
    Promise.resolve(
      header === "session=good" ? cookieCaller : Promise.reject(new Error("bad cookie")),
    ),
};

const requestWith = (headers: { authorization?: string; cookie?: string }): AuthenticatedRequest =>
  ({ headers }) as unknown as AuthenticatedRequest;

const contextOf = (request: AuthenticatedRequest): GuardContext =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as GuardContext;

const guard = new UserAuthGuard(authenticator);

describe("UserAuthGuard", () => {
  it("resolves a bearer token and attaches the caller", async () => {
    const request = requestWith({ authorization: "Bearer good" });
    deepStrictEqual(await guard.canActivate(contextOf(request)), true);
    deepStrictEqual(request.currentUser, bearerCaller);
  });

  it("falls back to the session cookie when no bearer is presented", async () => {
    const request = requestWith({ cookie: "session=good" });
    deepStrictEqual(await guard.canActivate(contextOf(request)), true);
    deepStrictEqual(request.currentUser, cookieCaller);
  });

  it("prefers the bearer over a cookie that is also present", async () => {
    const request = requestWith({ authorization: "Bearer good", cookie: "session=good" });
    await guard.canActivate(contextOf(request));
    deepStrictEqual(request.currentUser, bearerCaller);
  });

  it("treats a non-bearer Authorization header as absent", async () => {
    const request = requestWith({ authorization: "Basic abc", cookie: "session=good" });
    await guard.canActivate(contextOf(request));
    deepStrictEqual(request.currentUser, cookieCaller);
  });
});
