import { Inject, Injectable } from "@nestjs/common";
import type { Result } from "oxide.ts";

import { organizationAccessQueries } from "@/modules/billing/billing.imports.js";
import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

// Which org role confers billing authority is decided here, not in a policy,
// so the org module's role vocabulary never reaches billing's checks.
const BILLING_ADMIN_ROLE = "admin";

@Injectable()
export class OrganizationAccessLive extends OrganizationAccess {
  constructor(@Inject(AppQueryBus) private readonly queries: AppQueryBus) {
    super();
  }

  public async isMember(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    const membership = await this.queries.execute(
      new organizationAccessQueries.FindMembershipQuery({ userId, organizationId }),
    );
    return membership.map((view) => view.isMember);
  }

  public async isAdmin(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<boolean, PersistenceUnavailable>> {
    const roles = await this.queries.execute(
      new organizationAccessQueries.FindUserOrganizationRolesQuery({ userId, organizationId }),
    );
    return roles.map((view) => view.roles.includes(BILLING_ADMIN_ROLE));
  }
}
