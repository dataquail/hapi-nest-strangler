import { Err, Ok, type Result } from "oxide.ts";

import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import type { UserRoot } from "@/modules/user/domain/user/user.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class UserRepositoryFake extends UserRepository {
  private readonly store = new Map<UserId, UserRoot>();

  public insertOne(
    user: UserRoot,
  ): Promise<Result<void, UserAlreadyExists | PersistenceUnavailable>> {
    const duplicate = [...this.store.values()].some((existing) => existing.email === user.email);
    if (duplicate) return Promise.resolve(Err(new UserAlreadyExists({ email: user.email })));
    this.store.set(user.id, user);
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(user: UserRoot): Promise<Result<void, UserNotFound | PersistenceUnavailable>> {
    if (!this.store.has(user.id))
      return Promise.resolve(Err(new UserNotFound({ userId: user.id })));
    this.store.set(user.id, user);
    return Promise.resolve(Ok(undefined));
  }

  public deleteOne(id: UserId): Promise<Result<void, UserNotFound | PersistenceUnavailable>> {
    if (!this.store.delete(id)) return Promise.resolve(Err(new UserNotFound({ userId: id })));
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<UserRoot>,
  ): Promise<Result<UserRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
