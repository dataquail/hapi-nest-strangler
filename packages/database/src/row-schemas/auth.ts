import { z } from "zod";

export const AuthIdentityRow = z.object({
  subject: z.string(),
  user_id: z.guid(),
  provider: z.string(),
  created_at: z.date(),
});
export type AuthIdentityRow = z.infer<typeof AuthIdentityRow>;

export const SessionRow = z.object({
  id: z.guid(),
  user_id: z.guid(),
  subject: z.string(),
  expires_at: z.date(),
  absolute_expires_at: z.date(),
  revoked_at: z.date().nullable(),
  created_at: z.date(),
  last_used_at: z.date(),
});
export type SessionRow = z.infer<typeof SessionRow>;

export const ApiTokenRow = z.object({
  id: z.guid(),
  user_id: z.guid(),
  token_hash: z.string(),
  prefix: z.string(),
  label: z.string(),
  expires_at: z.date().nullable(),
  revoked_at: z.date().nullable(),
  created_at: z.date(),
  last_used_at: z.date(),
});
export type ApiTokenRow = z.infer<typeof ApiTokenRow>;

export const DeviceGrantRow = z.object({
  id: z.guid(),
  device_code_hash: z.string(),
  user_code: z.string(),
  status: z.string(),
  user_id: z.guid().nullable(),
  created_at: z.date(),
  expires_at: z.date(),
  approved_at: z.date().nullable(),
});
export type DeviceGrantRow = z.infer<typeof DeviceGrantRow>;
