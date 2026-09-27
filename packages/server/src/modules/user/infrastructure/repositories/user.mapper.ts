import type { RowSchemas } from "@org/database";

import { UserRoot } from "@/modules/user/domain/user/user.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  id: "id",
  email: "email",
} as const satisfies Partial<Record<keyof UserRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.UserRow): UserRoot =>
  UserRoot.parse({
    id: UserId.parse(row.id),
    email: row.email,
    address:
      row.country !== null && row.street !== null && row.postal_code !== null
        ? { country: row.country, street: row.street, postalCode: row.postal_code }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly email: string;
  readonly country: string | null;
  readonly street: string | null;
  readonly postal_code: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (user: UserRoot): PersistenceRow => ({
  id: user.id,
  email: user.email,
  country: user.address?.country ?? null,
  street: user.address?.street ?? null,
  postal_code: user.address?.postalCode ?? null,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});
