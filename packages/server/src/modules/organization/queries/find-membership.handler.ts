import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { sql } from "@org/database";
import { z } from "zod";

import { Database } from "@/platform/database/database.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindMembershipQuery,
  type FindMembershipResult,
  type MembershipView,
} from "./find-membership.policy-query.js";

const CountRow = z.object({ value: z.number() });

@QueryHandler(FindMembershipQuery)
export class FindMembershipHandler implements IQueryHandler<FindMembershipQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindMembershipQuery): Promise<FindMembershipResult> {
    return translateDatabaseErrors(async (): Promise<MembershipView> => {
      const row = await this.db.one(sql.type(CountRow)`
        SELECT COUNT(*)::int AS value FROM "organization".memberships
        WHERE user_id = ${payload.userId} AND organization_id = ${payload.organizationId}
      `);
      return { isMember: row.value > 0 };
    });
  }
}
