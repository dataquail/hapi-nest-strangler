import { z } from "zod";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";

export const WalletRoot = z
  .object({
    id: WalletId,
    organizationId: OrganizationId,
    balance: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .readonly();
export type WalletRoot = z.infer<typeof WalletRoot>;
