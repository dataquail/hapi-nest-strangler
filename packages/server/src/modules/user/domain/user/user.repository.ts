import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { UserAlreadyExists, UserNotFound } from "./user.errors.js";
import type { UserRoot } from "./user.root.js";

export abstract class UserRepository {
  public abstract insertOne(
    user: UserRoot,
  ): Promise<Result<void, UserAlreadyExists | PersistenceUnavailable>>;
  public abstract updateOne(
    user: UserRoot,
  ): Promise<Result<void, UserNotFound | PersistenceUnavailable>>;
  public abstract deleteOne(
    id: UserId,
  ): Promise<Result<void, UserNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<UserRoot>,
  ): Promise<Result<UserRoot | null, PersistenceUnavailable>>;
}
