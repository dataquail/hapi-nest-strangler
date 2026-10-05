import { z } from "zod";

// Rows the legacy API writes to `public` and the Nest server only reads until
// the auth module moves across; they leave with it.
export const LegacySessionRow = z.object({
  id: z.guid(),
  user_id: z.guid(),
  expires_at: z.date(),
  absolute_expires_at: z.date(),
  revoked_at: z.date().nullable(),
  last_used_at: z.date(),
});
export type LegacySessionRow = z.infer<typeof LegacySessionRow>;

export const LegacyApiTokenRow = z.object({
  id: z.guid(),
  user_id: z.guid(),
  expires_at: z.date().nullable(),
  revoked_at: z.date().nullable(),
  last_used_at: z.date(),
});
export type LegacyApiTokenRow = z.infer<typeof LegacyApiTokenRow>;
