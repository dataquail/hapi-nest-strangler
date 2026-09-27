import { z } from "zod";

export const WalletId = z.guid().brand<"WalletId">();
export type WalletId = z.infer<typeof WalletId>;
