import type { ServerRoute } from "@hapi/hapi";

import config = require("../../../config");
import Joi = require("../../lib/joi");
import type AuthService = require("./auth-service");

// The RFC 8628 shaped device flow the CLI drives: start returns the codes,
// token polls until the browser has approved.
const cliAuthRoutes = (authService: AuthService): ServerRoute[] => [
  {
    method: "POST",
    path: "/cli/device/start",
    handler: async (_request, h) => {
      const { deviceCode, userCode } = await authService.startDeviceGrant();
      const verificationUri = `${config("/appUrl")}/device`;
      return h
        .response({
          device_code: deviceCode,
          user_code: userCode,
          verification_uri: verificationUri,
          verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
          interval: authService.settings.devicePollIntervalSeconds,
          expires_in: authService.settings.deviceCodeTtlSeconds,
        })
        .code(201);
    },
    options: { tags: ["api"], description: "Start a CLI device authorization", auth: false },
  },
  {
    method: "POST",
    path: "/cli/device/token",
    handler: async (request) => {
      const { device_code } = request.payload as { device_code: string };
      const { apiToken, token } = await authService.pollDeviceGrant(device_code);
      return {
        access_token: token,
        token_type: "Bearer",
        expires_at: apiToken.expires_at === null ? null : apiToken.expires_at.toISOString(),
      };
    },
    options: {
      tags: ["api"],
      description: "Exchange an approved device code for a token",
      auth: false,
      validate: { payload: Joi.object({ device_code: Joi.string().required() }) },
    },
  },
];

cliAuthRoutes["@singleton"] = true;
cliAuthRoutes["@require"] = ["auth/auth-service"];

export = cliAuthRoutes;
