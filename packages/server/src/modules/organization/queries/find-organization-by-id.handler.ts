import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { sql } from "@org/database";
import { z } from "zod";

import { Database } from "@/platform/database/database.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindOrganizationByIdQuery,
  type FindOrganizationByIdResult,
  type OrganizationAuthzView,
} from "./find-organization-by-id.query.js";

const IdRow = z.object({ id: z.string() });

@QueryHandler(FindOrganizationByIdQuery)
export class FindOrganizationByIdHandler implements IQueryHandler<FindOrganizationByIdQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindOrganizationByIdQuery): Promise<FindOrganizationByIdResult> {
    return translateDatabaseErrors(async (): Promise<OrganizationAuthzView | null> => {
      const row = await this.db.maybeOne(sql.type(IdRow)`
        SELECT id FROM "organization".organizations WHERE id = ${payload.organizationId}
      `);
      return row === null ? null : { organizationId: OrganizationId.parse(row.id) };
    });
  }
}
