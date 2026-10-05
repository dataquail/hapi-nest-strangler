import type { ServerRoute } from "@hapi/hapi";

import { actionConstants } from "../../constants/acl/action-constants";
import { can } from "../../lib/access/can";
import { proxiedRouteOptions, proxyToNest } from "../../lib/backend-client/proxy-to-nest";
import { asyncValidation } from "../../lib/hapi-async-validation";
import Joi = require("../../lib/joi");
import { problem } from "../../lib/problem";
import type BillingService = require("./billing-service");

const billingRoutes = (billingService: BillingService, rowExists: any): ServerRoute[] => {
  const orgParams = asyncValidation(
    { orgId: Joi.string().uuid().required() },
    {
      orgId: rowExists("organization", "id", "Organization not found", {
        tag: "OrganizationNotFoundError",
        fields: (organizationId: string) => ({
          organizationId,
          message: `Organization ${organizationId} not found`,
        }),
      }),
    },
  );
  return [
    {
      method: "POST",
      path: "/orgs/{orgId}/billing/subscriptions",
      handler: async (request, h) =>
        h.response(await billingService.startSubscription((request.params as any).orgId)).code(201),
      options: {
        tags: ["api"],
        description: "Subscribe the organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.MANAGE_BILLING, "params.orgId") }] },
        validate: { params: orgParams, payload: Joi.object({}).unknown(false).allow(null) },
      },
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
      handler: (request) => billingService.cancelSubscription((request.params as any).orgId),
      options: {
        tags: ["api"],
        description: "Cancel the organization's subscription",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.MANAGE_BILLING, "params.orgId") }] },
        validate: { params: orgParams },
      },
    },
    {
      method: "POST",
      path: "/webhooks/stripe",
      handler: async (request, h) => {
        // No session: the signature over the raw body is the authentication.
        const header = request.headers["stripe-signature"];
        const signature = Array.isArray(header) ? header[0] : header;
        if (!signature)
          throw problem(401, "Unauthorized", { message: "Missing stripe-signature header" });
        const raw = request.payload as Buffer | null;
        if (!raw || raw.length === 0)
          throw problem(400, "BadRequest", { message: "Missing request body" });
        await billingService.ingestStripeWebhook(raw.toString("utf8"), signature);
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Stripe webhook receiver",
        auth: false,
        payload: { parse: false, output: "data" },
      },
    },
  ];
};

billingRoutes["@singleton"] = true;
billingRoutes["@require"] = [
  "billing/billing-service",
  "hapi-async-validation/bookshelf/row-exists",
];

export = billingRoutes;
