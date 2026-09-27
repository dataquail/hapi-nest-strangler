import { Err, Ok, type Result } from "oxide.ts";

import { SessionNotFound, SessionRevoked } from "@/modules/auth/domain/session/session.errors.js";
import type { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import type { SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class SessionRepositoryFake extends SessionRepository {
  private readonly store = new Map<SessionId, SessionRoot>();

  public insertOne(session: SessionRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(session.id, session);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<SessionRoot>,
  ): Promise<Result<SessionRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }

  public deleteOne(
    id: SessionId,
  ): Promise<Result<void, SessionNotFound | SessionRevoked | PersistenceUnavailable>> {
    const found = this.store.get(id);
    if (found === undefined) return Promise.resolve(Err(new SessionNotFound({ sessionId: id })));
    if (found.revokedAt !== null)
      return Promise.resolve(Err(new SessionRevoked({ sessionId: id })));
    this.store.set(id, { ...found, revokedAt: new Date() });
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(
    session: SessionRoot,
  ): Promise<Result<void, SessionNotFound | PersistenceUnavailable>> {
    const found = this.store.get(session.id);
    if (found === undefined || found.revokedAt !== null) {
      return Promise.resolve(Err(new SessionNotFound({ sessionId: session.id })));
    }
    this.store.set(session.id, session);
    return Promise.resolve(Ok(undefined));
  }
}
