import { z } from "zod";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const MembershipRoot = z
  .object({
    userId: UserId,
    organizationId: OrganizationId,
    createdAt: z.date(),
  })
  .readonly();
export type MembershipRoot = z.infer<typeof MembershipRoot>;
