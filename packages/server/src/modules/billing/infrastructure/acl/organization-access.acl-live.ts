import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

// Which org role confers billing authority is decided here, not in a policy,
// so the org module's role vocabulary never reaches billing's checks.
const BILLING_ADMIN_ROLE = "admin";

// The organization module still lives on the legacy API, so membership and
// org roles are read from the rows it writes; when it moves, this asks its
// policy queries.
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

  public isAdmin(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const grant = await this.db.maybeOne(sql.type(RowSchemas.LegacyOrganizationRoleRow)`
        SELECT user_id, organization_id, role FROM public.organization_roles
        WHERE user_id = ${userId} AND organization_id = ${organizationId}
          AND role = ${BILLING_ADMIN_ROLE}
      `);
      return grant !== null;
    });
  }
}
