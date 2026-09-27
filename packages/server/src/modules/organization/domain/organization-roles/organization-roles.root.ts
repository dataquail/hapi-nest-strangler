import { z } from "zod";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRoleValueObject } from "./organization-role.value-object.js";

export const IssuedRoleValueObject = z
  .object({ role: OrganizationRoleValueObject, issuedBy: UserId })
  .readonly();
export type IssuedRoleValueObject = z.infer<typeof IssuedRoleValueObject>;

export const OrganizationRolesRoot = z
  .object({
    userId: UserId,
    organizationId: OrganizationId,
    roles: z.array(IssuedRoleValueObject).readonly(),
  })
  .readonly();
export type OrganizationRolesRoot = z.infer<typeof OrganizationRolesRoot>;
