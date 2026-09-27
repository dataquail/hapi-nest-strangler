import Boom from "@hapi/boom";
import type { Manifest } from "@hapi/glue";

import bootstrap = require("./bootstrap");
import config = require("./config");
import * as logger from "./src/lib/logger";

const server: Manifest["server"] = {
  routes: {
    cors: {
      origin: ["*"],
      additionalHeaders: ["session-id", "traceparent", "tracestate"],
    },
    security: {
      xframe: "sameorigin",
    },
    validate: {
      options: { abortEarly: false },
      failAction: (_request, _h, error) => {
        if ((error as any)?.isBoom) {
          throw error;
        }
        throw Boom.badImplementation(error?.message ?? "validation failed");
      },
    },
  },
  host: "0.0.0.0",
  port: config("/port"),
};

const plugins: NonNullable<Manifest["register"]>["plugins"] = [
  {
    plugin: require("hapi-pino"),
    options: {
      instance: logger.instance,
      logRequestComplete: config("/env") !== "test",
    },
  },
  {
    plugin: bootstrap,
  },
];

const manifest: Manifest = {
  server,
  register: {
    plugins,
  },
};

export = manifest;
