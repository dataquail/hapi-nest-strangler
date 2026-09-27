import type { RowSchemas } from "@org/database";

import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  id: "id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof WalletRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.WalletRow): WalletRoot =>
  WalletRoot.parse({
    id: WalletId.parse(row.id),
    organizationId: OrganizationId.parse(row.organization_id),
    balance: row.balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly balance: number;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (wallet: WalletRoot): PersistenceRow => ({
  id: wallet.id,
  organization_id: wallet.organizationId,
  balance: wallet.balance,
  created_at: wallet.createdAt,
  updated_at: wallet.updatedAt,
});
