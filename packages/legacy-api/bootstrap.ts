import type { Plugin, Server } from "@hapi/hapi";
import * as ioc from "electrolyte";
import path from "path";

import Joi = require("./src/lib/joi");

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

    (server.app as any).bookshelf = await ioc.create("bookshelf");

    const routeArrays = await Promise.all([]);

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
