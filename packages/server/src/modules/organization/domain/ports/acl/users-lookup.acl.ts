import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type UserLookupView = {
  readonly userId: UserId;
  readonly email: string;
};

export abstract class UsersLookup {
  public abstract findByIds(
    ids: ReadonlyArray<UserId>,
  ): Promise<Result<ReadonlyArray<UserLookupView>, PersistenceUnavailable>>;
}
