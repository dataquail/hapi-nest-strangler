import Boom from "@hapi/boom";
import type { Request, ResponseToolkit, ServerAuthScheme } from "@hapi/hapi";

import config = require("../../../config");
import type UserService = require("../user/user-service");
import type AuthService = require("./auth-service");
import { hashCredential, readBearer, verifyCookie } from "./token-utils";

// The one strategy every private route names: a bearer API token takes
// precedence over the session cookie; either resolves to the bookshelf user
// with its roles, which is what the ACL and the handlers read.
const sessionScheme = (authService: AuthService, userService: UserService): ServerAuthScheme =>
  function scheme() {
    return {
      authenticate: async (request: Request, h: ResponseToolkit) => {
        const bearer = readBearer(request.headers.authorization as string | undefined);
        if (bearer) {
          const token = await authService.findApiTokenByHash(hashCredential(bearer));
          if (!token) throw Boom.unauthorized();
          const user = await userService.fetchUserWithRoles(token.user_id);
          if (!user) throw Boom.unauthorized();
          authService.fireAndForget(authService.touchApiToken(token));
          return h.authenticated({ credentials: { user, sessionId: token.id, authType: "TOKEN" } });
        }

        const raw = request.state[config("/auth/sessionCookieName")];
        const sessionId = typeof raw === "string" && raw !== "" ? verifyCookie(raw) : null;
        if (!sessionId) throw Boom.unauthorized();
        const session = await authService.findSession(sessionId);
        if (!session) throw Boom.unauthorized();
        const user = await userService.fetchUserWithRoles(session.user_id);
        if (!user) throw Boom.unauthorized();
        authService.fireAndForget(authService.touchSession(session));
        return h.authenticated({
          credentials: { user, sessionId: session.id, authType: "SESSION" },
        });
      },
    };
  };

sessionScheme["@singleton"] = true;
sessionScheme["@require"] = ["auth/auth-service", "user/user-service"];

export = sessionScheme;
