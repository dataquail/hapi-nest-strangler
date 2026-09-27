import { z } from "zod";

import { OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationRoot = z
  .object({
    id: OrganizationId,
    name: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
  })
  .readonly();
export type OrganizationRoot = z.infer<typeof OrganizationRoot>;
