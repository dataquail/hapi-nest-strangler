import { z } from "zod";

export const UserRow = z.object({
  id: z.guid(),
  email: z.string(),
  country: z.string().nullable(),
  street: z.string().nullable(),
  postal_code: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type UserRow = z.infer<typeof UserRow>;
