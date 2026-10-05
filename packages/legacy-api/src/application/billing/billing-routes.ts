import type { ServerRoute } from "@hapi/hapi";

import { proxiedRouteOptions, proxyToNest } from "../../lib/backend-client/proxy-to-nest";

// Every billing route is the Nest server's now, the Stripe webhook included:
// the signature is over the bytes, which the proxy forwards untouched. These
// stay only until the gateway in front of both servers points there directly.
const billingRoutes = (): ServerRoute[] => [
  {
    method: "POST",
    path: "/orgs/{orgId}/billing/subscriptions",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Subscribe the organization, on the Nest server", true),
  },
  {
    method: "GET",
    path: "/orgs/{orgId}/billing/subscriptions/current",
    handler: proxyToNest(),
    options: proxiedRouteOptions(
      "The organization's current subscription, served by the Nest server",
      false,
    ),
  },
  {
    method: "DELETE",
    path: "/orgs/{orgId}/billing/subscriptions/current",
    handler: proxyToNest(),
    options: proxiedRouteOptions(
      "Cancel the organization's subscription, on the Nest server",
      false,
    ),
  },
  {
    method: "POST",
    path: "/webhooks/stripe",
    handler: proxyToNest(),
    options: proxiedRouteOptions("Stripe webhook receiver, on the Nest server", true),
  },
];

billingRoutes["@singleton"] = true;
billingRoutes["@require"] = [];

export = billingRoutes;
