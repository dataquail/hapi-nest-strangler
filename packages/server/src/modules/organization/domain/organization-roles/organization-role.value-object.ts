import { z } from "zod";

export const OrganizationRoleValueObject = z.literal("admin");
export type OrganizationRoleValueObject = z.infer<typeof OrganizationRoleValueObject>;
