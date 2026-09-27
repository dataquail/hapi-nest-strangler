import { z } from "zod";

export const OrganizationId = z.guid().brand<"OrganizationId">();
export type OrganizationId = z.infer<typeof OrganizationId>;
