import type { ServerRoute } from "@hapi/hapi";

import { proxiedRouteOptions, proxyToNest } from "../../lib/backend-client/proxy-to-nest";

// Every todo route is the Nest server's now; these stay only until the web
// proxy points there directly.
const todoRoutes = (): ServerRoute[] => [
  {
    method: "GET",
    path: "/orgs/{orgId}/todos",
    handler: proxyToNest(),
    options: proxiedRouteOptions("The organization's todos, served by the Nest server", false),
  },
  {
    method: "POST",
    path: "/orgs/{orgId}/todos",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Add a todo to the organization, on the Nest server", true),
  },
  {
    method: "PUT",
    path: "/orgs/{orgId}/todos/{id}",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Rename or complete a todo, on the Nest server", true),
  },
  {
    method: "DELETE",
    path: "/orgs/{orgId}/todos/{id}",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Delete a todo, on the Nest server", false),
  },
];

todoRoutes["@singleton"] = true;
todoRoutes["@require"] = [];

export = todoRoutes;
