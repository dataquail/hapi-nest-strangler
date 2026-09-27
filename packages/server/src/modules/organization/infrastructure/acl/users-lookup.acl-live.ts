import { Inject, Injectable } from "@nestjs/common";
import type { Result } from "oxide.ts";

import {
  type UserLookupView,
  UsersLookup,
} from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { userAccessQueries } from "@/modules/organization/organization.imports.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

@Injectable()
export class UsersLookupLive extends UsersLookup {
  constructor(@Inject(AppQueryBus) private readonly queries: AppQueryBus) {
    super();
  }

  public async findByIds(
    ids: ReadonlyArray<UserId>,
  ): Promise<Result<ReadonlyArray<UserLookupView>, PersistenceUnavailable>> {
    const users = await this.queries.execute(new userAccessQueries.FindUsersByIdsQuery({ ids }));
    return users.map((views) => views.map((user) => ({ userId: user.id, email: user.email })));
  }
}
