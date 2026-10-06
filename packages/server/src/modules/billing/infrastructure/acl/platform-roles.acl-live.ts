import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { PlatformRoles } from "@/modules/billing/domain/ports/acl/platform-roles.acl.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const SUPER_ADMIN = "super_admin";

// Platform roles are still granted on the legacy API, so the grant is read
// from the rows it writes; when the role module moves, this asks its query.
@Injectable()
export class PlatformRolesLive extends PlatformRoles {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public isSuperAdmin(userId: UserId): Promise<Result<boolean, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const grant = await this.db.maybeOne(sql.type(RowSchemas.LegacyRoleRow)`
        SELECT user_id, role FROM public.roles
        WHERE user_id = ${userId} AND role = ${SUPER_ADMIN}
      `);
      return grant !== null;
    });
  }
}
