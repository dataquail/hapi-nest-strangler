import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { SessionNotFound, SessionRevoked } from "./session.errors.js";
import type { SessionId } from "./session.id.js";
import type { SessionRoot } from "./session.root.js";

export abstract class SessionRepository {
  public abstract insertOne(session: SessionRoot): Promise<Result<void, PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<SessionRoot>,
  ): Promise<Result<SessionRoot | null, PersistenceUnavailable>>;
  public abstract deleteOne(
    id: SessionId,
  ): Promise<Result<void, SessionNotFound | SessionRevoked | PersistenceUnavailable>>;
  public abstract updateOne(
    session: SessionRoot,
  ): Promise<Result<void, SessionNotFound | PersistenceUnavailable>>;
}
