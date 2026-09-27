import { Err, Ok, type Result } from "oxide.ts";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import type { InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";

export class InvitationRepositoryFake extends InvitationRepository {
  private readonly store = new Map<InvitationId, InvitationRoot>();

  public insertOne(invitation: InvitationRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(invitation.id, invitation);
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(
    invitation: InvitationRoot,
  ): Promise<Result<void, InvitationNotFound | PersistenceUnavailable>> {
    if (!this.store.has(invitation.id)) {
      return Promise.resolve(Err(new InvitationNotFound({ invitationId: invitation.id })));
    }
    this.store.set(invitation.id, invitation);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<InvitationRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok(this.sorted().find(spec) ?? null));
  }

  public findMany(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>> {
    return Promise.resolve(Ok(this.sorted().filter(spec)));
  }

  private sorted(): Array<InvitationRoot> {
    return [...this.store.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
