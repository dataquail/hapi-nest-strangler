import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { WalletId } from "../domain/wallet/wallet.id.js";
import {
  FindWalletByOrganizationQuery,
  type FindWalletByOrganizationResult,
  type WalletView,
} from "./find-wallet-by-organization.query.js";

@QueryHandler(FindWalletByOrganizationQuery)
export class FindWalletByOrganizationHandler implements IQueryHandler<FindWalletByOrganizationQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({
    payload,
  }: FindWalletByOrganizationQuery): Promise<FindWalletByOrganizationResult> {
    return translateDatabaseErrors(async (): Promise<WalletView | null> => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.WalletRow)`
        SELECT * FROM wallet.wallets WHERE organization_id = ${payload.organizationId}
      `);
      return row === null
        ? null
        : {
            id: WalletId.parse(row.id),
            organizationId: OrganizationId.parse(row.organization_id),
            balance: row.balance,
          };
    });
  }
}
