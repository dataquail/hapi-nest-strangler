import Boom from "@hapi/boom";
import type { Request, ResponseToolkit } from "@hapi/hapi";
import get from "lodash/get";

import * as logger from "../logger";
import { aclQueryPromise } from "./aclQueryPromise";

type ActionSpec = string | { action: string; suffix: string; glue?: string };

// A route pre-handler: `can(EDIT, "params.user")` reads the resource off the
// request (a row an async validator already loaded) or takes the literal
// resource name, and asks the ACL for the current user.
export const can =
  (action: ActionSpec, resourcePath: string) => async (request: Request, h: ResponseToolkit) => {
    try {
      const user = (request.auth.credentials as any)?.user;
      if (user?.authType === "MACHINE") {
        return h.continue;
      }
      if (!user) {
        return Boom.forbidden();
      }

      const derivedResource = get(request, resourcePath) || resourcePath;
      let derivedAction: string;
      if (typeof action === "object" && action !== null) {
        const glue = action.glue || "-";
        derivedAction = `${action.action}${glue}${get(request, action.suffix) || action.suffix}`;
      } else {
        derivedAction = action;
      }

      const allowed = await aclQueryPromise(user, derivedResource, derivedAction);
      return allowed ? h.continue : Boom.forbidden();
    } catch (e) {
      logger.error("Access control check failed", e);
      return Boom.badImplementation();
    }
  };
