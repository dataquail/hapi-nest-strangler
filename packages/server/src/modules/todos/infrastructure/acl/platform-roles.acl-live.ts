import { Inject, Injectable } from "@nestjs/common";
import type { Result } from "oxide.ts";

import { PlatformRoles } from "@/modules/todos/domain/ports/acl/platform-roles.acl.js";
import { roleAccessQueries } from "@/modules/todos/todos.imports.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

const SUPER_ADMIN = "super_admin";

@Injectable()
export class PlatformRolesLive extends PlatformRoles {
  constructor(@Inject(AppQueryBus) private readonly queries: AppQueryBus) {
    super();
  }

  public async isSuperAdmin(userId: UserId): Promise<Result<boolean, PersistenceUnavailable>> {
    const roles = await this.queries.execute(new roleAccessQueries.FindUserRolesQuery({ userId }));
    return roles.map((view) => view.roles.includes(SUPER_ADMIN));
  }
}
