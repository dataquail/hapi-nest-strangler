import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import {
  WalletAlreadyExistsForOrganization,
  WalletNotFound,
} from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import type { WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as WalletMapper from "./wallet.mapper.js";

@Injectable()
export class WalletRepositoryLive extends WalletRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(
    wallet: WalletRoot,
  ): Promise<Result<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>> {
    const row = WalletMapper.toPersistence(wallet);
    return translateDatabaseErrors(
      async () => {
        await this.db.exec(sql.unsafe`
          INSERT INTO wallet.wallets (id, organization_id, balance, created_at, updated_at)
          VALUES (${row.id}, ${row.organization_id}, ${row.balance},
                  ${sql.timestamp(row.created_at)}, ${sql.timestamp(row.updated_at)})
        `);
      },
      (error) =>
        error.type === "unique_violation"
          ? new WalletAlreadyExistsForOrganization({ organizationId: wallet.organizationId })
          : null,
    );
  }

  public async deleteOne(
    organizationId: OrganizationId,
  ): Promise<Result<void, WalletNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        DELETE FROM wallet.wallets WHERE organization_id = ${organizationId}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new WalletNotFound({ organizationId })) : Ok(undefined);
  }

  // The unique organization_id index guarantees at most one wallet per org.
  public findOne(
    spec: Specification<WalletRoot>,
  ): Promise<Result<WalletRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.WalletRow)`
        SELECT * FROM wallet.wallets
        WHERE ${criteriaToWhere(spec.criteria, WalletMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : WalletMapper.toDomain(row);
    });
  }
}
