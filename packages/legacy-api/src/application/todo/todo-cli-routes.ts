import type { ServerRoute } from "@hapi/hapi";

import { proxiedRouteOptions, proxyToNest } from "../../lib/backend-client/proxy-to-nest";

// The same todos over the CLI paths, all served by the Nest server now.
const todoCliRoutes = (): ServerRoute[] => [
  {
    method: "GET",
    path: "/cli/orgs/{orgId}/todos",
    handler: proxyToNest(),
    options: proxiedRouteOptions(
      "The organization's todos for the CLI, served by the Nest server",
      false,
    ),
  },
  {
    method: "POST",
    path: "/cli/orgs/{orgId}/todos",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Add a todo from the CLI, on the Nest server", true),
  },
  {
    method: "POST",
    path: "/cli/orgs/{orgId}/todos/{id}/complete",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Complete a todo from the CLI, on the Nest server", false),
  },
  {
    method: "DELETE",
    path: "/cli/orgs/{orgId}/todos/{id}",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Delete a todo from the CLI, on the Nest server", false),
  },
];

todoCliRoutes["@singleton"] = true;
todoCliRoutes["@require"] = [];

export = todoCliRoutes;
