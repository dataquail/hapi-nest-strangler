import type { Plugin, Server } from "@hapi/hapi";
import * as ioc from "electrolyte";
import path from "path";

import config = require("./config");
import Joi = require("./src/lib/joi");
import { tagBoomPayload } from "./src/lib/problem";

// The container loads modules by string id from these two directories. The
// extensions list is what lets the same code run from TypeScript source (tsx
// in development, the tsx hook under vitest) and from build/ in production.
const IOC_EXTENSIONS = [".js", ".ts"];

const bootstrap: Plugin<Record<string, never>> = {
  name: "legacy-api",
  version: "1.0.0",
  register: async (server: Server) => {
    const ONE_MINUTE = 60 * 1000;
    server.listener.keepAliveTimeout = ONE_MINUTE + 5000;
    server.listener.setTimeout(ONE_MINUTE);
    server.listener.headersTimeout = ONE_MINUTE + 6000;

    ioc.use(
      ioc.dir({ dirname: path.join(__dirname, "src/application"), extensions: IOC_EXTENSIONS }),
    );
    ioc.use(ioc.dir({ dirname: path.join(__dirname, "src/lib"), extensions: IOC_EXTENSIONS }));

    // inject the hapi server object into the DI container
    ioc.use(function (id: string) {
      if (id === "server") {
        (server as any)["@literal"] = true;
        return server;
      }
      return undefined;
    });

    server.ext("onRequest", function (request, h) {
      // rewrite requests from /api/* to /*
      request.setUrl(request.path.replace(/^\/api\//, "/") + request.url.search);
      return h.continue;
    });

    server.ext("onPreResponse", (request, h) => {
      const response = request.response as any;
      if (response?.isBoom) tagBoomPayload(response);
      return h.continue;
    });

    const authConfig = config("/auth");
    server.state(authConfig.sessionCookieName, {
      ttl: null,
      isSecure: false,
      isHttpOnly: true,
      isSameSite: "Strict",
      path: "/",
      encoding: "none",
      strictHeader: false,
    });
    server.state("oidc_pkce", {
      ttl: 300_000,
      isSecure: false,
      isHttpOnly: true,
      isSameSite: "Lax",
      path: "/",
      encoding: "none",
      strictHeader: false,
    });

    (server.app as any).bookshelf = await ioc.create("bookshelf");

    server.auth.scheme("session", await ioc.create("auth/session-scheme"));
    server.auth.strategy("session", "session");

    const routeArrays = await Promise.all([
      ioc.create("user/user-routes"),
      ioc.create("auth/auth-routes"),
      ioc.create("auth/cli-auth-routes"),
    ]);

    server.validator(Joi);

    server.route([
      {
        method: "GET",
        path: "/health-check",
        handler: () => "all good",
      },
    ]);

    routeArrays.forEach((routes) => {
      server.route(routes);
    });
  },
};

export = bootstrap;
