import type { Plugin, Server } from "@hapi/hapi";
import * as ioc from "electrolyte";

import { mirrorEvents } from "./src/constants/mirror-events";
import * as logger from "./src/lib/logger";

type MirroredTodo = { organizationId: string; id: string };
type MirroredTodoCreate = MirroredTodo & { title: string };
type MirroredTodoUpdate = MirroredTodo & { title: string; completed: boolean };

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

    server.event(mirrorEvents.TODO_UPDATED);
    server.events.on(mirrorEvents.TODO_UPDATED, (todo: MirroredTodoUpdate) => {
      forward(`todo ${todo.id} update`, () =>
        backendClient.todos.update(todo.organizationId, todo.id, {
          title: todo.title,
          completed: todo.completed,
        }),
      );
    });

    server.event(mirrorEvents.TODO_COMPLETED);
    server.events.on(mirrorEvents.TODO_COMPLETED, (todo: MirroredTodo) => {
      forward(`todo ${todo.id} complete`, () =>
        backendClient.todos.complete(todo.organizationId, todo.id),
      );
    });

    server.event(mirrorEvents.TODO_DELETED);
    server.events.on(mirrorEvents.TODO_DELETED, (todo: MirroredTodo) => {
      forward(`todo ${todo.id} delete`, () =>
        backendClient.todos.remove(todo.organizationId, todo.id),
      );
    });
  },
};

export = plugin;
