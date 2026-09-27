import type { ServerRoute } from "@hapi/hapi";

import { currentUser } from "../../lib/access/current-user";
import type OrganizationService = require("./organization-service");

const organizationCliRoutes = (organizationService: OrganizationService): ServerRoute[] => [
  {
    method: "GET",
    path: "/cli/orgs",
    handler: async (request) => {
      const mine = await organizationService.findMine(currentUser(request).get("id"));
      return mine.map((org) => ({ id: org.id, name: org.name, isAdmin: org.isAdmin }));
    },
    options: {
      tags: ["api"],
      description: "The caller's organizations, for the CLI",
      auth: "session",
    },
  },
];

organizationCliRoutes["@singleton"] = true;
organizationCliRoutes["@require"] = ["organization/organization-service"];

export = organizationCliRoutes;
