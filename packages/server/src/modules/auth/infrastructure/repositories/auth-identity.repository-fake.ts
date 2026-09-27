import { Ok, type Result } from "oxide.ts";

import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class AuthIdentityRepositoryFake extends AuthIdentityRepository {
  private readonly store = new Map<string, AuthIdentity>();

  public findOne(
    spec: Specification<AuthIdentity>,
  ): Promise<Result<AuthIdentity | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }

  public insertOne(identity: AuthIdentity): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(identity.subject, identity);
    return Promise.resolve(Ok(undefined));
  }
}
