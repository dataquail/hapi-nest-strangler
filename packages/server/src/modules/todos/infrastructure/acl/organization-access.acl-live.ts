import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

// The organization module still lives on the legacy API, so membership is
// read from the rows it writes; when it moves, this asks its policy query.
@Injectable()
export class OrganizationAccessLive extends OrganizationAccess {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public isMember(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const membership = await this.db.maybeOne(sql.type(RowSchemas.LegacyMembershipRow)`
        SELECT user_id, organization_id FROM public.memberships
        WHERE user_id = ${userId} AND organization_id = ${organizationId}
      `);
      return membership !== null;
    });
  }
}
