import { Inject, Injectable } from "@nestjs/common";
import type { Result } from "oxide.ts";

import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { organizationAccessQueries } from "@/modules/todos/todos.imports.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

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
}
