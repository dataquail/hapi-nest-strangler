import { z } from "zod";

export const WalletRow = z.object({
  id: z.guid(),
  organization_id: z.guid(),
  balance: z.number(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type WalletRow = z.infer<typeof WalletRow>;
