import { z } from "zod";

import { OrganizationId } from "../EntityIds.js";
import { ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const CliOrganization = z
  .object({ id: OrganizationId, name: z.string(), isAdmin: z.boolean() })
  .meta({ id: "CliOrganization" });
export type CliOrganization = z.infer<typeof CliOrganization>;

export const Group = defineGroup({
  name: "cliOrganization",
  routes: {
    listMine: defineRoute({
      method: "get",
      path: "/cli/orgs",
      operationId: "cliOrganization.listMine",
      success: { status: 200, schema: z.array(CliOrganization) },
      errors: [ServiceUnavailable],
      security: "session",
    }),
  },
});
