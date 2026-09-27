import { z } from "zod";

import { OrganizationId, WalletId } from "../EntityIds.js";
import { defineError, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const WalletNotFoundError = defineError(
  "WalletNotFoundError",
  404,
  { message: z.string() },
  "No wallet exists for that organization",
);

export const Wallet = z
  .object({
    id: WalletId,
    organizationId: OrganizationId,
    balance: z.number().int(),
  })
  .meta({ id: "Wallet" });
export type Wallet = z.infer<typeof Wallet>;

export const CreateWalletPayload = z
  .object({ organizationId: OrganizationId })
  .meta({ id: "CreateWalletPayload" });
export type CreateWalletPayload = z.infer<typeof CreateWalletPayload>;

const OrganizationParams = z.object({ organizationId: OrganizationId });

// Service-to-service only: the legacy API opens a wallet when it creates an
// organization and closes it again if that creation fails after the fact, so
// both writes are idempotent and neither carries a user.
export const Group = defineGroup({
  name: "internal-wallets",
  routes: {
    create: defineRoute({
      method: "post",
      path: "/internal/wallets",
      operationId: "internalWallets.create",
      body: CreateWalletPayload,
      success: { status: 201, schema: Wallet },
      errors: [ServiceUnavailable],
      security: "service",
    }),
    get: defineRoute({
      method: "get",
      path: "/internal/wallets/{organizationId}",
      operationId: "internalWallets.get",
      params: OrganizationParams,
      success: { status: 200, schema: Wallet },
      errors: [WalletNotFoundError, ServiceUnavailable],
      security: "service",
    }),
    delete: defineRoute({
      method: "delete",
      path: "/internal/wallets/{organizationId}",
      operationId: "internalWallets.delete",
      params: OrganizationParams,
      success: { status: 204, schema: undefined },
      errors: [ServiceUnavailable],
      security: "service",
    }),
  },
});
