import { z } from "zod";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const InvitationRoot = z
  .object({
    id: InvitationId,
    organizationId: OrganizationId,
    inviteeEmail: z.string(),
    token: z.string(),
    expiresAt: z.date(),
    acceptedAt: z.date().nullable(),
    revokedAt: z.date().nullable(),
    createdAt: z.date(),
  })
  .readonly();
export type InvitationRoot = z.infer<typeof InvitationRoot>;
