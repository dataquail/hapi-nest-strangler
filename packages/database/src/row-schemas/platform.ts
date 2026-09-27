import { z } from "zod";

export const PlatformRoleRow = z.object({
  user_id: z.guid(),
  role: z.string(),
  granted_at: z.date(),
});
export type PlatformRoleRow = z.infer<typeof PlatformRoleRow>;
