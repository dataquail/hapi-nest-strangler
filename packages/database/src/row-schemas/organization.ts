import { z } from "zod";

export const OrganizationRow = z.object({
  id: z.guid(),
  name: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});
export type OrganizationRow = z.infer<typeof OrganizationRow>;

export const MembershipRow = z.object({
  user_id: z.guid(),
  organization_id: z.guid(),
  created_at: z.date(),
});
export type MembershipRow = z.infer<typeof MembershipRow>;

export const InvitationRow = z.object({
  id: z.guid(),
  organization_id: z.guid(),
  invitee_email: z.string(),
  token: z.string(),
  expires_at: z.date(),
  accepted_at: z.date().nullable(),
  revoked_at: z.date().nullable(),
  created_at: z.date(),
});
export type InvitationRow = z.infer<typeof InvitationRow>;

export const OrganizationRoleRow = z.object({
  organization_id: z.guid(),
  user_id: z.guid(),
  role: z.string(),
  issued_by: z.guid(),
  created_at: z.date(),
});
export type OrganizationRoleRow = z.infer<typeof OrganizationRoleRow>;
