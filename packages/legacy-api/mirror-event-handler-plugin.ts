import type { Plugin, Server } from "@hapi/hapi";
import * as ioc from "electrolyte";

import { mirrorEvents } from "./src/constants/mirror-events";
import * as logger from "./src/lib/logger";

type MirroredTodoCreate = { organizationId: string; id: string; title: string };

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

    server.event(mirrorEvents.TODO_CREATED);
    server.events.on(mirrorEvents.TODO_CREATED, (todo: MirroredTodoCreate) => {
      forward(`todo ${todo.id} create`, () =>
        backendClient.todos.create(todo.organizationId, { id: todo.id, title: todo.title }),
      );
    });
  },
};

export = plugin;
