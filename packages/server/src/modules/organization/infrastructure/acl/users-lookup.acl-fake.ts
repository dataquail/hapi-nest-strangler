import { Ok, type Result } from "oxide.ts";

import {
  type UserLookupView,
  UsersLookup,
} from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class UsersLookupFake extends UsersLookup {
  constructor(private readonly users: ReadonlyArray<UserLookupView> = []) {
    super();
  }

  public findByIds(
    ids: ReadonlyArray<UserId>,
  ): Promise<Result<ReadonlyArray<UserLookupView>, PersistenceUnavailable>> {
    const wanted = new Set(ids);
    return Promise.resolve(Ok(this.users.filter((user) => wanted.has(user.userId))));
  }
}
