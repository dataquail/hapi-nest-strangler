import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { InvitationNotFound } from "./invitation.errors.js";
import type { InvitationRoot } from "./invitation.root.js";

export abstract class InvitationRepository {
  public abstract insertOne(
    invitation: InvitationRoot,
  ): Promise<Result<void, PersistenceUnavailable>>;
  public abstract updateOne(
    invitation: InvitationRoot,
  ): Promise<Result<void, InvitationNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<InvitationRoot | null, PersistenceUnavailable>>;
  public abstract findMany(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>>;
}
