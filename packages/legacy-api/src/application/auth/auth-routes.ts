import type { ServerRoute } from "@hapi/hapi";

import config = require("../../../config");
import Joi = require("../../lib/joi");
import type OidcClient = require("../../lib/oidc-client");
import { currentUser } from "../../lib/access/current-user";
import { problem } from "../../lib/problem";
import type AuthService = require("./auth-service");
import {
  decodePkcePayload,
  encodePkcePayload,
  PKCE_COOKIE_NAME,
  signCookie,
  verifyCookie,
} from "./token-utils";

const toIso = (value: Date | null) => (value === null ? null : value.toISOString());

// The IdP rejects a redirect_uri that differs byte-for-byte from the
// authorize-time value: origin and path come from the config, only the query
// string from the inbound request.
const buildCallbackUrl = (envRedirectUri: string, requestUrl: string): URL => {
  const queryIndex = requestUrl.indexOf("?");
  const query = queryIndex >= 0 ? requestUrl.slice(queryIndex) : "";
  return new URL(envRedirectUri + query);
};

const authRoutes = (authService: AuthService, oidcClient: OidcClient): ServerRoute[] => {
  const cookieName: string = config("/auth/sessionCookieName");
  return [
    {
      method: "GET",
      path: "/auth/login",
      handler: async (_request, h) => {
        const { codeVerifier, state, url } = await oidcClient.buildAuthorize();
        return h
          .redirect(url.toString())
          .state(PKCE_COOKIE_NAME, signCookie(encodePkcePayload({ state, codeVerifier })));
      },
      options: { tags: ["api"], description: "Start the OIDC login", auth: false },
    },
    {
      method: "GET",
      path: "/auth/callback",
      handler: async (request, h) => {
        const signed = request.state[PKCE_COOKIE_NAME];
        if (typeof signed !== "string" || signed === "") {
          throw problem(401, "Unauthorized", { message: "Missing OIDC state cookie" });
        }
        const verified = verifyCookie(signed);
        if (verified === null)
          throw problem(401, "Unauthorized", { message: "Invalid OIDC state cookie" });
        const pkce = decodePkcePayload(verified);
        if (pkce === null)
          throw problem(401, "Unauthorized", { message: "Malformed OIDC state cookie" });

        const exchange = await oidcClient.exchangeCode(
          buildCallbackUrl(
            config("/auth/zitadel/redirectUri"),
            request.url.pathname + request.url.search,
          ),
          pkce.state,
          pkce.codeVerifier,
        );
        const { sessionId } = await authService.signIn(exchange.subject, exchange.email);
        return h
          .redirect(config("/appUrl"))
          .state(cookieName, signCookie(sessionId), {
            ttl: authService.settings.sessionTtlSeconds * 1000,
          })
          .unstate(PKCE_COOKIE_NAME);
      },
      options: {
        tags: ["api"],
        description: "Finish the OIDC login and set the session cookie",
        auth: false,
        validate: {
          query: Joi.object({
            code: Joi.string(),
            state: Joi.string(),
            error: Joi.string(),
            error_description: Joi.string(),
          }).unknown(true),
        },
      },
    },
    {
      method: "GET",
      path: "/auth/logout",
      handler: async (request, h) => {
        // Reads the cookie inline rather than behind the strategy: logout must
        // work when the session is already gone.
        const raw = request.state[cookieName];
        const sessionId = typeof raw === "string" && raw !== "" ? verifyCookie(raw) : null;
        if (sessionId) await authService.revokeSession(sessionId);
        const endSession = await oidcClient.buildEndSessionUrl();
        return h
          .redirect(endSession ? endSession.toString() : config("/appUrl"))
          .unstate(cookieName);
      },
      options: {
        tags: ["api"],
        description: "Revoke the session and end it at the IdP",
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/auth/me",
      handler: (request) => {
        const user = currentUser(request);
        return { userId: user.get("id"), isSuperAdmin: user.isSuperAdmin() };
      },
      options: { tags: ["api"], description: "The current user", auth: "session" },
    },
    {
      method: "POST",
      path: "/auth/tokens",
      handler: async (request, h) => {
        const payload = request.payload as { label: string; expiresInDays?: number };
        const { apiToken, token } = await authService.mintApiToken({
          userId: currentUser(request).get("id"),
          label: payload.label,
          expiresInDays: payload.expiresInDays ?? authService.settings.apiTokenDefaultTtlDays,
        });
        return h
          .response({
            id: apiToken.id,
            token,
            prefix: apiToken.prefix,
            expiresAt: toIso(apiToken.expires_at),
          })
          .code(201);
      },
      options: {
        tags: ["api"],
        description: "Mint a personal access token",
        auth: "session",
        validate: {
          payload: Joi.object({
            label: Joi.string().min(1).max(255).required(),
            expiresInDays: Joi.number().integer().min(1).max(3650),
          }),
        },
      },
    },
    {
      method: "GET",
      path: "/auth/tokens",
      handler: async (request) => {
        const rows = await authService.listMyApiTokens(currentUser(request).get("id"));
        return rows.map((row) => ({
          id: row.id,
          label: row.label,
          prefix: row.prefix,
          expiresAt: toIso(row.expires_at),
          createdAt: row.created_at.toISOString(),
          lastUsedAt: row.last_used_at.toISOString(),
        }));
      },
      options: { tags: ["api"], description: "List my personal access tokens", auth: "session" },
    },
    {
      method: "DELETE",
      path: "/auth/tokens/{id}",
      handler: async (request, h) => {
        await authService.revokeApiToken(
          (request.params as any).id,
          currentUser(request).get("id"),
        );
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Revoke one of my personal access tokens",
        auth: "session",
        validate: { params: Joi.object({ id: Joi.string().uuid().required() }) },
      },
    },
    {
      method: "POST",
      path: "/auth/device/approve",
      handler: async (request, h) => {
        const { userCode } = request.payload as { userCode: string };
        await authService.approveDeviceGrant(userCode, currentUser(request).get("id"));
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Approve a CLI device code for the signed-in user",
        auth: "session",
        validate: { payload: Joi.object({ userCode: Joi.string().min(1).max(32).required() }) },
      },
    },
  ];
};

authRoutes["@singleton"] = true;
authRoutes["@require"] = ["auth/auth-service", "oidc-client"];

export = authRoutes;
