import { z } from "zod";

// Rows the legacy API writes to `public` and a Nest module's ACL adapter reads
// until the organization and role modules move across; they leave with them.
export const LegacyMembershipRow = z.object({
  user_id: z.guid(),
  organization_id: z.guid(),
});
export type LegacyMembershipRow = z.infer<typeof LegacyMembershipRow>;

export const LegacyRoleRow = z.object({
  user_id: z.guid(),
  role: z.string(),
});
export type LegacyRoleRow = z.infer<typeof LegacyRoleRow>;
