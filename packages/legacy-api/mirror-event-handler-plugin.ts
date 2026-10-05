import type { Plugin, Server } from "@hapi/hapi";
import * as ioc from "electrolyte";

import { mirrorEvents } from "./src/constants/mirror-events";
import type { MirroredSubscriptionStart } from "./src/lib/backend-client/domains/billing";
import * as logger from "./src/lib/logger";

// While a module is dual-written its services announce each write as a mirror
// event once the row is in, and the forwards here replay it on the Nest
// server's internal API. A forward that fails is logged, never raised: this
// server stays the source of truth, and the backfill squares the replica.
const plugin: Plugin<Record<string, never>> = {
  name: "mirrorEventHandlerPlugin",
  register: async (server: Server) => {
    const backendClient = await ioc.create("backend-client/index");

    const forward = (what: string, work: () => Promise<unknown>) => {
      work().catch((error) => {
        logger.error(`mirror of ${what} failed`, error);
      });
    };

    server.event(mirrorEvents.SUBSCRIPTION_STARTED);
    server.events.on(mirrorEvents.SUBSCRIPTION_STARTED, (start: MirroredSubscriptionStart) => {
      forward(`subscription ${start.id} start`, () => backendClient.billing.recordStart(start));
    });
  },
};

export = plugin;
